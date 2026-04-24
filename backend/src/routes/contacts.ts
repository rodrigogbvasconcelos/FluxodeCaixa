import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit, getIp } from '../middleware/audit';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const { type, search } = req.query;
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
  const offset = (page - 1) * limit;

  let where = '1=1';
  const params: any[] = [];

  if (type && type !== 'all') {
    where += " AND (type = ? OR type = 'both')";
    params.push(type);
  }
  if (search) {
    where += ' AND (name LIKE ? OR document_number LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE ${where}`).get(...params) as any).c;
  const rows  = db.prepare(`SELECT * FROM contacts WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ data: rows, total, page, limit });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
  res.json(contact);
});

router.post('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, type, document_type, document_number, phone, email,
          cep, address, number, complement, neighborhood, city, state, notes } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO contacts (id, name, type, document_type, document_number, phone, email,
      cep, address, number, complement, neighborhood, city, state, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, document_type || null, document_number || null,
         phone || null, email || null, cep || null, address || null,
         number || null, complement || null, neighborhood || null,
         city || null, state || null, notes || null);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'CREATE', tableName: 'contacts', recordId: id,
    newData: { name, type, document_type, document_number, phone, email, city, state },
    ip: getIp(req),
  });

  res.status(201).json({ id });
});

router.put('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, type, document_type, document_number, phone, email,
          cep, address, number, complement, neighborhood, city, state, notes } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
  }

  const old = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any;

  db.prepare(`
    UPDATE contacts SET name = ?, type = ?, document_type = ?, document_number = ?,
      phone = ?, email = ?, cep = ?, address = ?, number = ?, complement = ?,
      neighborhood = ?, city = ?, state = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(name, type, document_type || null, document_number || null,
         phone || null, email || null, cep || null, address || null,
         number || null, complement || null, neighborhood || null,
         city || null, state || null, notes || null, req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'UPDATE', tableName: 'contacts', recordId: req.params.id,
    oldData: old ?? null,
    newData: { name, type, document_type, document_number, phone, email, city, state },
    ip: getIp(req),
  });

  res.json({ message: 'Contato atualizado' });
});

router.delete('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const old = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'DELETE', tableName: 'contacts', recordId: req.params.id,
    oldData: old ?? null,
    ip: getIp(req),
  });

  res.json({ message: 'Contato excluído' });
});

// Import contacts from CSV/JSON array
router.post('/import', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Nenhum registro para importar' });
  }

  const VALID_TYPES_C = new Set(['client', 'supplier', 'both']);
  const insert = db.prepare(`
    INSERT INTO contacts (id, name, type, document_type, document_number, phone, email,
      cep, address, number, complement, neighborhood, city, state, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  const errors: string[] = [];

  const importMany = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lineNum = i + 2;
      if (!r.name || !r.type) {
        errors.push(`Linha ${lineNum}: nome e tipo são obrigatórios`);
        continue;
      }
      if (!VALID_TYPES_C.has(String(r.type))) {
        errors.push(`Linha ${lineNum}: tipo inválido "${r.type}" (use client, supplier ou both)`);
        continue;
      }
      try {
        insert.run(uuidv4(), String(r.name).slice(0, 200), r.type,
          r.document_type || null, r.document_number || null,
          r.phone || null, r.email || null, r.cep || null,
          r.address || null, r.number || null, r.complement || null,
          r.neighborhood || null, r.city || null, r.state || null, r.notes || null);
        imported++;
      } catch (e: any) {
        errors.push(`Linha ${lineNum}: ${e.message}`);
      }
    }
  });

  importMany();
  res.json({ imported, errors });
});

export default router;
