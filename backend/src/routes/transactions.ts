import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const VALID_TYPES = new Set(['income', 'expense']);
const MAX_PAGE_SIZE = 200;

router.get('/', (req: AuthRequest, res: Response) => {
  const { project_id, type, category_id, start_date, end_date } = req.query;
  const rawPage  = parseInt(String(req.query.page  || '1'),  10);
  const rawLimit = parseInt(String(req.query.limit || '50'), 10);

  const page  = isNaN(rawPage)  || rawPage  < 1 ? 1  : rawPage;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, MAX_PAGE_SIZE);

  // Validate type filter if provided
  if (type && !VALID_TYPES.has(String(type))) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  let where = '1=1';
  const params: any[] = [];

  if (project_id)  { where += ' AND t.project_id = ?';   params.push(project_id); }
  if (type)        { where += ' AND t.type = ?';          params.push(type); }
  if (category_id) { where += ' AND t.category_id = ?';  params.push(category_id); }
  if (start_date)  { where += ' AND t.date >= ?';         params.push(start_date); }
  if (end_date)    { where += ' AND t.date <= ?';         params.push(end_date); }

  const offset = (page - 1) * limit;

  const total = (db.prepare(`SELECT COUNT(*) as c FROM transactions t WHERE ${where}`).get(...params) as any).c;
  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.type as category_type,
      p.name as project_name, u.name as created_by_name,
      i.original_name as invoice_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN invoices i ON i.id = t.invoice_id
    WHERE ${where}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ data: rows, total, page, limit });
});

router.post('/', requireRole('admin', 'manager', 'operator'), (req: AuthRequest, res: Response) => {
  const { project_id, category_id, type, amount, description, vendor, document_number,
          date, payment_method, notes, invoice_id } = req.body;

  if (!project_id || !category_id || !type || amount === undefined || !description || !date) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Use "income" ou "expense"' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  if (typeof description !== 'string' || description.trim().length === 0 || description.length > 500) {
    return res.status(400).json({ error: 'Descrição inválida' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO transactions (id, project_id, category_id, type, amount, description, vendor,
      document_number, date, payment_method, notes, invoice_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, project_id, category_id, type, parsedAmount, description.trim(), vendor || null,
         document_number || null, date, payment_method || null, notes || null,
         invoice_id || null, req.user!.id);

  res.status(201).json({ id });
});

router.put('/:id', requireRole('admin', 'manager', 'operator'), (req: AuthRequest, res: Response) => {
  const { project_id, category_id, type, amount, description, vendor, document_number,
          date, payment_method, notes, invoice_id } = req.body;

  if (!project_id || !category_id || !type || amount === undefined || !description || !date) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  if (typeof description !== 'string' || description.trim().length === 0 || description.length > 500) {
    return res.status(400).json({ error: 'Descrição inválida' });
  }

  db.prepare(`
    UPDATE transactions SET project_id = ?, category_id = ?, type = ?, amount = ?,
      description = ?, vendor = ?, document_number = ?, date = ?, payment_method = ?,
      notes = ?, invoice_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(project_id, category_id, type, parsedAmount, description.trim(), vendor || null,
         document_number || null, date, payment_method || null, notes || null,
         invoice_id || null, req.params.id);

  res.json({ message: 'Lançamento atualizado' });
});

router.delete('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Lançamento excluído' });
});

export default router;
