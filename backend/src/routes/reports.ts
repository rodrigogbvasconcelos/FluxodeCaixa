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

    // Total income for this project
    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE project_id = ? AND type = 'income'
    `).get(p.id) as any;

    return { ...p, categories, totalBudget, totalActual, totalIncome: incomeRow.total };
  });

  res.json(result);
});

// ─── Físico-Financeiro ──────────────────────────────────────────────────────
router.get('/physical-financial', (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];

  const projects = db.prepare(`
    SELECT p.*,
      COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'income'), 0)  as total_income,
      COALESCE((SELECT SUM(amount) FROM transactions WHERE project_id = p.id AND type = 'expense'), 0) as total_expenses,
      COALESCE((SELECT SUM(amount) FROM budgets WHERE project_id = p.id), 0) as total_budgeted,
      COALESCE((SELECT SUM(amount) FROM transactions
                WHERE project_id = p.id AND type = 'expense' AND status = 'pending'), 0) as pending_expenses,
      COALESCE((SELECT SUM(amount) FROM transactions
                WHERE project_id = p.id AND type = 'income'  AND status = 'pending'), 0) as pending_income,
      COALESCE((SELECT SUM(amount) FROM transactions
                WHERE project_id = p.id AND type = 'expense' AND status = 'pending'
                  AND due_date IS NOT NULL AND due_date < ?), 0) as overdue_expenses,
      COALESCE((SELECT COUNT(*) FROM transactions
                WHERE project_id = p.id AND status = 'pending'
                  AND due_date IS NOT NULL AND due_date < ?), 0) as overdue_count,
      (SELECT strftime('%Y-%m', MIN(date)) FROM transactions WHERE project_id = p.id) as first_tx_month,
      (SELECT strftime('%Y-%m', MAX(date)) FROM transactions WHERE project_id = p.id) as last_tx_month
    FROM projects p
    WHERE p.status != 'archived'
    ORDER BY p.name
  `).all(today, today);

  // Per-project monthly cash flow (for burn rate calculation)
  const result = (projects as any[]).map(proj => {
    const monthlyData = db.prepare(`
      SELECT strftime('%Y-%m', date) as month,
        SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM transactions
      WHERE project_id = ? AND status = 'paid'
      GROUP BY month
      ORDER BY month
    `).all(proj.id);

    // Burn rate: average monthly expenses over last 3 paid months
    const paidMonths = (monthlyData as any[]).filter(m => m.expense > 0).slice(-3);
    const burnRate = paidMonths.length > 0
      ? paidMonths.reduce((s: number, m: any) => s + m.expense, 0) / paidMonths.length
      : 0;

    // Days remaining if end_date set
    let daysRemaining: number | null = null;
    let projectedFinalCost: number | null = null;
    if (proj.end_date) {
      const end = new Date(proj.end_date);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const monthsRemaining = daysRemaining / 30;
      projectedFinalCost = proj.total_expenses + (burnRate * monthsRemaining) + proj.pending_expenses;
    }

    // Financial advancement (% of budget spent)
    const financialPct = proj.total_budget > 0
      ? Math.min((proj.total_expenses / proj.total_budget) * 100, 150)
      : 0;

    // IDC (Cost Performance Index)
    const cpi = proj.total_expenses > 0
      ? (financialPct > 0 && proj.progress_pct > 0
          ? (proj.progress_pct / financialPct)
          : null)
      : null;

    return {
      ...proj,
      burnRate,
      daysRemaining,
      projectedFinalCost,
      financialPct,
      cpi,
      monthlyData,
    };
  });

  res.json(result);
});

// ─── Previsão Financeira ─────────────────────────────────────────────────────
router.get('/forecast', (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const projectId = req.query.project_id as string | undefined;

  let whereBase = "t.status = 'pending' AND t.due_date IS NOT NULL";
  const params: any[] = [];
  if (projectId) { whereBase += ' AND t.project_id = ?'; params.push(projectId); }

  // All pending transactions with due dates
  const pending = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color,
      p.name as project_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${whereBase}
    ORDER BY t.due_date ASC
  `).all(...params) as any[];

  // Group pending by month
  const forecastMap: Record<string, { month: string; income: number; expense: number; count: number }> = {};
  for (const t of pending) {
    const m = t.due_date.slice(0, 7);
    if (!forecastMap[m]) forecastMap[m] = { month: m, income: 0, expense: 0, count: 0 };
    if (t.type === 'income')  forecastMap[m].income  += t.amount;
    else                      forecastMap[m].expense += t.amount;
    forecastMap[m].count++;
  }

  // Historical monthly averages (last 6 months paid)
  let histWhere = "status = 'paid' AND date >= date('now', '-6 months')";
  const histParams: any[] = [];
  if (projectId) { histWhere += ' AND project_id = ?'; histParams.push(projectId); }

  const historical = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
      COUNT(*) as count
    FROM transactions
    WHERE ${histWhere}
    GROUP BY month
    ORDER BY month
  `).all(...histParams) as any[];

  // Average monthly for projection reference
  const avgIncome  = historical.length > 0 ? historical.reduce((s, m) => s + m.income,  0) / historical.length : 0;
  const avgExpense = historical.length > 0 ? historical.reduce((s, m) => s + m.expense, 0) / historical.length : 0;

  // Overdue summary
  let overdueWhere = "status = 'pending' AND due_date IS NOT NULL AND due_date < ?";
  const overdueParams: any[] = [today];
  if (projectId) { overdueWhere += ' AND project_id = ?'; overdueParams.push(projectId); }

  const overdueRow = db.prepare(`
    SELECT
      COUNT(*) as count,
      SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE ${overdueWhere}
  `).get(...overdueParams) as any;

  const totalPendingIncome  = pending.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalPendingExpense = pending.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  res.json({
    forecast: Object.values(forecastMap).sort((a, b) => a.month.localeCompare(b.month)),
    historical,
    avgIncome,
    avgExpense,
    totalPendingIncome,
    totalPendingExpense,
    overdue: overdueRow,
    pendingList: pending.slice(0, 50),
  });
});

export default router;
