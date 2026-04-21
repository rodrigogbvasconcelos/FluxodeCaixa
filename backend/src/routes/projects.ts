import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit, getIp } from '../middleware/audit';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const projects = db.prepare(`
    SELECT p.*,
      u.name as created_by_name,
      (SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'income') as total_income,
      (SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'expense') as total_expenses
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const project = db.prepare(`
    SELECT p.*,
      u.name as created_by_name,
      (SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'income') as total_income,
      (SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'expense') as total_expenses
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(req.params.id);

  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json(project);
});

router.post('/', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, description, client, address, start_date, end_date, total_budget, progress_pct } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const id = uuidv4();
    const safePct = Math.min(100, Math.max(0, Number(progress_pct) || 0));
    const safeBudget = Number(total_budget) || 0;
    db.prepare(`
      INSERT INTO projects (id, name, description, client, address, start_date, end_date, total_budget, progress_pct, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), description || null, client || null, address || null,
           start_date || null, end_date || null, safeBudget, safePct, req.user!.id);

    logAudit({
      userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
      action: 'CREATE', tableName: 'projects', recordId: id,
      newData: { name, description, client, address, start_date, end_date, total_budget: safeBudget, progress_pct: safePct },
      ip: getIp(req),
    });

    res.status(201).json({ id, name });
  } catch (err: any) {
    console.error('[PROJECTS] Erro ao criar projeto:', err);
    res.status(500).json({ error: 'Erro ao criar projeto: ' + (err.message || 'erro interno') });
  }
});

router.put('/:id', requireRole('admin', 'manager'), (req: AuthRequest, res: Response) => {
  const { name, description, client, address, start_date, end_date, status, total_budget, progress_pct } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const old = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
    if (!old) return res.status(404).json({ error: 'Projeto não encontrado' });

    const safePct = Math.min(100, Math.max(0, Number(progress_pct) || 0));
    const safeBudget = Number(total_budget) || 0;

    db.prepare(`
      UPDATE projects SET name = ?, description = ?, client = ?, address = ?,
      start_date = ?, end_date = ?, status = ?, total_budget = ?, progress_pct = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name.trim(), description || null, client || null, address || null,
           start_date || null, end_date || null, status || 'active', safeBudget, safePct, req.params.id);

    logAudit({
      userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
      action: 'UPDATE', tableName: 'projects', recordId: req.params.id,
      oldData: old ?? null,
      newData: { name, description, client, address, start_date, end_date, status, total_budget: safeBudget },
      ip: getIp(req),
    });

    res.json({ message: 'Projeto atualizado' });
  } catch (err: any) {
    console.error('[PROJECTS] Erro ao atualizar projeto:', err);
    res.status(500).json({ error: 'Erro ao atualizar projeto: ' + (err.message || 'erro interno') });
  }
});

router.delete('/:id', requireRole('admin'), (req: AuthRequest, res: Response) => {
  const old = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
  db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('archived', req.params.id);

  logAudit({
    userId: req.user!.id, userName: req.user!.name, userEmail: req.user!.email,
    action: 'ARCHIVE', tableName: 'projects', recordId: req.params.id,
    oldData: old ?? null,
    newData: { status: 'archived' },
    ip: getIp(req),
  });

  res.json({ message: 'Projeto arquivado' });
});

router.get('/:id/summary', (req: AuthRequest, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

  const byCategory = db.prepare(`
    SELECT c.id, c.name, c.type, c.color,
      COALESCE(SUM(t.amount), 0) as actual,
      COALESCE((SELECT SUM(b.amount) FROM budgets b WHERE b.category_id = c.id AND b.project_id = ?), 0) as budget
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND t.project_id = ?
    WHERE c.type = 'expense'
    GROUP BY c.id
    ORDER BY actual DESC
  `).all(req.params.id, req.params.id);

  const monthlyFlow = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE project_id = ?
    GROUP BY month
    ORDER BY month
  `).all(req.params.id);

  res.json({ project, byCategory, monthlyFlow });
});

export default router;
