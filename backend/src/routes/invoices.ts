import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractInvoiceData } from '../services/invoiceExtractor';

const router = Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  }
});

router.post('/upload', upload.single('invoice'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não fornecido' });

  const extracted = await extractInvoiceData(req.file.path, req.file.mimetype);
  const id = uuidv4();

  db.prepare(`
    INSERT INTO invoices (id, original_name, file_path, file_size, mime_type, extracted_data, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.file.originalname, req.file.filename, req.file.size,
         req.file.mimetype, JSON.stringify(extracted), req.user!.id);

  res.json({ id, extracted, filename: req.file.originalname });
});

router.get('/:id/download', (req: AuthRequest, res: Response) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as any;
  if (!invoice) return res.status(404).json({ error: 'Arquivo não encontrado' });

  const filePath = path.join(UPLOAD_DIR, invoice.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo não encontrado no disco' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(invoice.original_name)}"`);
  res.setHeader('Content-Type', invoice.mime_type || 'application/octet-stream');
  res.sendFile(filePath);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const invoice = db.prepare('SELECT id, original_name, file_size, mime_type, uploaded_at FROM invoices WHERE id = ?')
    .get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Não encontrado' });
  res.json(invoice);
});

export default router;
