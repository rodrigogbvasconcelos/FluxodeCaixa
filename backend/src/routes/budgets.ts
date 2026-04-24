import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit, getIp } from '../middleware/audit';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const { project_id } = req.query;
  let query = `
    SELECT b.*, c.name as category_name, c.color as category_color, c.type as category_type
    FROM budgets b
    LEFT JOIN categories c ON c.id = b.category_id
  `;
  const params: any[] = [];
  if (project_id) {
    query += ' WHERE b.project_id = ?';
    params.push(project_id);
  }
  query += ' ORDER BY c.type, c.name';
  res.json(db.prepare(query).all(...params));
});

router.post('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { project_id, category_id, amount, month, year, notes } = req.body;
  if (!project_id || !category_id || amount === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const existing = db.prepare(
    'SELECT id FROM budgets WHERE project_id = ? AND category_id = ? AND (month = ? OR (month IS NULL AND ? IS NULL)) AND (year = ? OR (year IS NULL AND ? IS NULL))'
  ).get(project_id, category_id, month || null, month || null, year || null, year || null) as any;

  if (existing) {
    db.prepare('UPDATE budgets SET amount = ?, notes = ?, updated_at = datetime("now") WHERE id = ?')
      .run(amount, notes || null, existing.id);

    logAudit({
      userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
      action: 'UPDATE', tableName: 'budgets', recordId: existing.id,
      newData: { project_id, category_id, amount, month, year, notes },
      ip: getIp(req),
    });

    return res.json({ id: existing.id });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO budgets (id, project_id, category_id, amount, month, year, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, project_id, category_id, amount, month || null, year || null, notes || null);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'CREATE', tableName: 'budgets', recordId: id,
    newData: { project_id, category_id, amount, month, year, notes },
    ip: getIp(req),
  });

  res.status(201).json({ id });
});

router.delete('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const old = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id) as any;
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'DELETE', tableName: 'budgets', recordId: req.params.id,
    oldData: old ?? null,
    ip: getIp(req),
  });

  res.json({ message: 'Orçamento excluído' });
});

router.get('/comparison', (req: AuthRequest, res: Response) => {
  const { project_id } = req.query;
  const where = project_id ? 'AND t.project_id = ?' : '';
  const params = project_id ? [project_id, project_id] : [];

  const data = db.prepare(`
    SELECT
      c.id, c.name, c.type, c.color, c.parent_id,
      COALESCE(SUM(t.amount), 0) as actual,
      COALESCE((
        SELECT SUM(b.amount) FROM budgets b
        WHERE b.category_id = c.id ${project_id ? 'AND b.project_id = ?' : ''}
      ), 0) as budget
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id ${where}
    GROUP BY c.id
    HAVING actual > 0 OR budget > 0
    ORDER BY c.type, c.parent_id NULLS FIRST, c.name
  `).all(...params);

  res.json(data);
});

export default router;
