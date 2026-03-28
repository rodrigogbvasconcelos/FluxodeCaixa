import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractInvoiceData } from '../services/invoiceExtractor';

const router = Router();
router.use(authenticate);

const UPLOAD_DIR = path.resolve(path.join(__dirname, '..', '..', 'uploads'));
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types mapped to safe Content-Type values
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/png':       'image/png',
  'image/jpeg':      'image/jpeg',
  'text/plain':      'text/plain; charset=utf-8',
};

// File extensions allowed (derived from the MIME map above)
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.txt']);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Only use the safe extension; UUID ensures no path components
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES[file.mimetype] && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// Upload rate limit: 20 uploads / 15 min per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de uploads atingido. Tente novamente em 15 minutos.' },
});

router.post('/upload', uploadLimiter, upload.single('invoice'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não fornecido' });

  const extracted = await extractInvoiceData(req.file.path, req.file.mimetype);
  const id = uuidv4();

  // Store only the basename (UUID filename), never the full path
  const safeFilename = path.basename(req.file.filename);

  db.prepare(`
    INSERT INTO invoices (id, original_name, file_path, file_size, mime_type, extracted_data, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.file.originalname, safeFilename, req.file.size,
         req.file.mimetype, JSON.stringify(extracted), req.user!.id);

  res.json({ id, extracted, filename: req.file.originalname });
});

/** Shared helper: resolve invoice file path and validate it */
function resolveInvoiceFile(invoice: any): { resolvedPath: string; safeContentType: string; safeName: string } | null {
  const resolvedPath = path.resolve(path.join(UPLOAD_DIR, path.basename(invoice.file_path)));
  if ((!resolvedPath.startsWith(UPLOAD_DIR + path.sep) && resolvedPath !== UPLOAD_DIR) || !fs.existsSync(resolvedPath)) {
    return null;
  }
  const safeContentType = ALLOWED_MIME_TYPES[invoice.mime_type] || 'application/octet-stream';
  const safeName = (invoice.original_name || 'arquivo').replace(/[^\w.\-\s]/g, '_').slice(0, 200);
  return { resolvedPath, safeContentType, safeName };
}

router.get('/:id/download', (req: AuthRequest, res: Response) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Arquivo não encontrado' });
  const file = resolveInvoiceFile(invoice);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.safeName)}"`);
  res.setHeader('Content-Type', file.safeContentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.resolvedPath);
});

/** Serve the file inline (for browser preview of PDFs and images) */
router.get('/:id/view', (req: AuthRequest, res: Response) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Arquivo não encontrado' });
  const file = resolveInvoiceFile(invoice);
  if (!file) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });

  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.safeName)}"`);
  res.setHeader('Content-Type', file.safeContentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.resolvedPath);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const invoice = db.prepare('SELECT id, original_name, file_size, mime_type, uploaded_at FROM invoices WHERE id = ?')
    .get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Não encontrado' });
  res.json(invoice);
});

export default router;
