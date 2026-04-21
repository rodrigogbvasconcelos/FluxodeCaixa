import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import db, { reinitDb, DB_PATH } from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin')); // Backup/restore: admin only

const UPLOADS_DIR = path.resolve(path.join(__dirname, '..', '..', 'uploads'));
const DATA_DIR = path.dirname(DB_PATH);

const TABLES = ['users', 'projects', 'categories', 'budgets', 'invoices', 'transactions', 'contacts', 'audit_logs'];

function getTableCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    try {
      counts[table] = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c;
    } catch {
      counts[table] = 0;
    }
  }
  return counts;
}

function dirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : fs.statSync(full).size;
  }
  return total;
}

// GET /api/backup/info
router.get('/info', (_req: AuthRequest, res: Response) => {
  try {
    const dbStat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
    res.json({
      db_size: dbStat?.size ?? 0,
      uploads_size: dirSizeBytes(UPLOADS_DIR),
      table_counts: getTableCounts(),
    });
  } catch (err) {
    console.error('backup info error:', err);
    res.status(500).json({ error: 'Erro ao obter informações do banco de dados' });
  }
});

// GET /api/backup/download
router.get('/download', (req: AuthRequest, res: Response) => {
  try {
    // Checkpoint WAL so the DB file is self-contained
    db.pragma('wal_checkpoint(FULL)');

    const zip = new AdmZip();

    // metadata
    const metadata = {
      version: '1.0.0',
      app: 'FluxoCaixa',
      created_at: new Date().toISOString(),
      created_by: req.user?.name || req.user?.email || 'admin',
      table_counts: getTableCounts(),
    };
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

    // database file
    if (fs.existsSync(DB_PATH)) {
      zip.addLocalFile(DB_PATH, '', 'cashflow.db');
    }

    // uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      const addDir = (dir: string, zipPath: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const zp = zipPath ? `${zipPath}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            addDir(full, zp);
          } else {
            zip.addLocalFile(full, zipPath, entry.name);
          }
        }
      };
      addDir(UPLOADS_DIR, 'uploads');
    }

    const buffer = zip.toBuffer();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `fluxocaixa-backup-${ts}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    console.error('backup download error:', err);
    res.status(500).json({ error: 'Erro ao gerar backup' });
  }
});

// POST /api/backup/restore
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .zip são aceitos'));
    }
  },
});

router.post('/restore', upload.single('backup'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Arquivo de backup não enviado' });
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'Arquivo ZIP inválido ou corrompido' });
    }

    // Validate: must contain metadata.json and cashflow.db
    const metaEntry = zip.getEntry('metadata.json');
    const dbEntry = zip.getEntry('cashflow.db');

    if (!dbEntry) {
      return res.status(400).json({ error: 'Backup inválido: cashflow.db não encontrado no arquivo' });
    }
    if (!metaEntry) {
      return res.status(400).json({ error: 'Backup inválido: metadata.json não encontrado no arquivo' });
    }

    // Validate metadata
    let meta: any;
    try {
      meta = JSON.parse(metaEntry.getData().toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Backup inválido: metadata.json corrompido' });
    }
    if (meta.app !== 'FluxoCaixa') {
      return res.status(400).json({ error: 'Backup inválido: arquivo não é um backup do FluxoCaixa' });
    }

    // Write new DB to a temp file
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempDbPath = path.join(DATA_DIR, `cashflow.restore.${Date.now()}.db`);
    fs.writeFileSync(tempDbPath, dbEntry.getData());

    // Replace uploads directory
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    for (const entry of zip.getEntries()) {
      if (!entry.entryName.startsWith('uploads/')) continue;
      const rel = entry.entryName.slice('uploads/'.length);
      if (!rel) continue;
      // Security: reject path traversal
      const dest = path.resolve(UPLOADS_DIR, rel);
      if (!dest.startsWith(UPLOADS_DIR)) continue;

      if (entry.isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, entry.getData());
      }
    }

    // Replace DB and reopen connection after response is flushed (no process restart needed)
    res.json({
      message: 'Restauração concluída com sucesso. Recarregue a página para ver os dados restaurados.',
      backup_date: meta.created_at,
      table_counts: meta.table_counts,
    });

    setImmediate(() => {
      try {
        reinitDb(tempDbPath);
        fs.unlinkSync(tempDbPath);
      } catch (err) {
        console.error('[BACKUP] Erro ao restaurar banco de dados:', err);
      }
    });
  } catch (err) {
    console.error('backup restore error:', err);
    res.status(500).json({ error: 'Erro ao restaurar backup' });
  }
});

export default router;
