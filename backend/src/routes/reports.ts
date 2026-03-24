import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', (req: AuthRequest, res: Response) => {
  const totalProjects = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status != 'archived'").get() as any).c;

  const totals = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses
    FROM transactions
  `).get() as any;

  const monthlyFlow = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions
    WHERE date >= date('now', '-12 months')
    GROUP BY month
    ORDER BY month
  `).all();

  const topProjects = db.prepare(`
    SELECT p.id, p.name, p.status, p.total_budget,
      SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as income,
      SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as expenses
    FROM projects p
    LEFT JOIN transactions t ON t.project_id = p.id
    WHERE p.status != 'archived'
    GROUP BY p.id
    ORDER BY expenses DESC
    LIMIT 5
  `).all();

  const recentTransactions = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color,
      p.name as project_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 10
  `).all();

  const expensesByCategory = db.prepare(`
    SELECT c.name, c.color, SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.type = 'expense'
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT 8
  `).all();

  const incomeByCategory = db.prepare(`
    SELECT c.name, c.color, SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.type = 'income'
    GROUP BY c.id
    ORDER BY total DESC
  `).all();

  res.json({
    totalProjects,
    totalIncome: totals?.total_income || 0,
    totalExpenses: totals?.total_expenses || 0,
    balance: (totals?.total_income || 0) - (totals?.total_expenses || 0),
    monthlyFlow,
    topProjects,
    recentTransactions,
    expensesByCategory,
    incomeByCategory,
  });
});

router.get('/transactions', (req: AuthRequest, res: Response) => {
  const { project_id, start_date, end_date, type } = req.query;

  let where = '1=1';
  const params: any[] = [];

  if (project_id) { where += ' AND t.project_id = ?'; params.push(project_id); }
  if (type) { where += ' AND t.type = ?'; params.push(type); }
  if (start_date) { where += ' AND t.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND t.date <= ?'; params.push(end_date); }

  const transactions = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color,
      p.name as project_name, u.name as created_by_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE ${where}
    ORDER BY t.date DESC
  `).all(...params);

  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
      COUNT(*) as count
    FROM transactions t WHERE ${where}
  `).get(...params) as any;

  res.json({ transactions, summary });
});

router.get('/budget-comparison', (req: AuthRequest, res: Response) => {
  const { project_id } = req.query;

  const projects = project_id
    ? db.prepare('SELECT * FROM projects WHERE id = ?').all(project_id)
    : db.prepare("SELECT * FROM projects WHERE status != 'archived' ORDER BY name").all();

  const result = projects.map((p: any) => {
    const categories = db.prepare(`
      SELECT c.id, c.name, c.color, c.type,
        COALESCE((SELECT SUM(b.amount) FROM budgets b WHERE b.project_id = ? AND b.category_id = c.id), 0) as budget,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.project_id = ? AND t.category_id = c.id AND t.type = 'expense'), 0) as actual_expense,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.project_id = ? AND t.category_id = c.id AND t.type = 'income'), 0) as actual_income
      FROM categories c
      WHERE c.type = 'expense'
      ORDER BY c.name
    `).all(p.id, p.id, p.id);

    const totalBudget = categories.reduce((s: number, c: any) => s + c.budget, 0);
    const totalActual = categories.reduce((s: number, c: any) => s + c.actual_expense, 0);

    return { ...p, categories, totalBudget, totalActual };
  });

  res.json(result);
});

export default router;
