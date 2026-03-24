import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const { type, project_id } = req.query;
  const today = new Date().toISOString().split('T')[0];

  let where = "t.status = 'pending'";
  const params: any[] = [];

  if (type === 'income' || type === 'expense') {
    where += ' AND t.type = ?';
    params.push(type);
  }
  if (project_id) {
    where += ' AND t.project_id = ?';
    params.push(project_id);
  }

  const rows = db.prepare(`
    SELECT t.*,
      c.name as category_name, c.color as category_color,
      p.name as project_name,
      CASE WHEN t.due_date IS NOT NULL AND t.due_date < '${today}' THEN 1 ELSE 0 END as is_overdue
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${where}
    ORDER BY
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
      t.due_date ASC,
      t.created_at DESC
  `).all(...params);

  const summaryRows = db.prepare(`
    SELECT
      type,
      COUNT(*) as count,
      SUM(amount) as total,
      SUM(CASE WHEN due_date IS NOT NULL AND due_date < '${today}' THEN amount ELSE 0 END) as overdue_total,
      COUNT(CASE WHEN due_date IS NOT NULL AND due_date < '${today}' THEN 1 END) as overdue_count
    FROM transactions
    WHERE status = 'pending'
    GROUP BY type
  `).all() as any[];

  const empty = { count: 0, total: 0, overdue_total: 0, overdue_count: 0 };
  const summary = {
    payables:    { ...empty, ...summaryRows.find(r => r.type === 'expense') },
    receivables: { ...empty, ...summaryRows.find(r => r.type === 'income') },
  };

  res.json({ data: rows, summary });
});

export default router;
