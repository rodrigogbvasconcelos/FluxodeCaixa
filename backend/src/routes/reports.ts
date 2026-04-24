import { Router, Response } from 'express';
import db from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

// Validate ISO date strings from query params (YYYY-MM-DD)
function isValidDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
}

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
  if (isValidDate(start_date)) { where += ' AND t.date >= ?'; params.push(start_date); }
  if (isValidDate(end_date))   { where += ' AND t.date <= ?'; params.push(end_date); }

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

  if ((projects as any[]).length === 0) return res.json([]);

  const projectIds = (projects as any[]).map(p => p.id);
  const placeholders = projectIds.map(() => '?').join(',');

  // Single query for all budgets across all projects
  const allBudgets = db.prepare(`
    SELECT project_id, category_id, SUM(amount) as amount
    FROM budgets WHERE project_id IN (${placeholders})
    GROUP BY project_id, category_id
  `).all(...projectIds) as any[];

  // Single query for all expense transactions across all projects
  const allExpenses = db.prepare(`
    SELECT project_id, category_id,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as actual_expense,
      SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) as actual_income
    FROM transactions WHERE project_id IN (${placeholders})
    GROUP BY project_id, category_id
  `).all(...projectIds) as any[];

  // Single query for all income totals
  const allIncomeTotals = db.prepare(`
    SELECT project_id, COALESCE(SUM(amount), 0) as total
    FROM transactions WHERE project_id IN (${placeholders}) AND type = 'income'
    GROUP BY project_id
  `).all(...projectIds) as any[];

  // All expense categories (one query)
  const allCategories = db.prepare(
    "SELECT id, name, color, type FROM categories WHERE type = 'expense' ORDER BY name"
  ).all() as any[];

  // Build lookup maps for O(1) access
  const budgetMap: Record<string, Record<string, number>> = {};
  for (const b of allBudgets) {
    if (!budgetMap[b.project_id]) budgetMap[b.project_id] = {};
    budgetMap[b.project_id][b.category_id] = b.amount;
  }
  const expenseMap: Record<string, Record<string, { actual_expense: number; actual_income: number }>> = {};
  for (const e of allExpenses) {
    if (!expenseMap[e.project_id]) expenseMap[e.project_id] = {};
    expenseMap[e.project_id][e.category_id] = { actual_expense: e.actual_expense, actual_income: e.actual_income };
  }
  const incomeMap: Record<string, number> = {};
  for (const i of allIncomeTotals) incomeMap[i.project_id] = i.total;

  const result = (projects as any[]).map(p => {
    const categories = allCategories.map((c: any) => ({
      ...c,
      budget: budgetMap[p.id]?.[c.id] || 0,
      actual_expense: expenseMap[p.id]?.[c.id]?.actual_expense || 0,
      actual_income: expenseMap[p.id]?.[c.id]?.actual_income || 0,
    }));
    const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
    const totalActual = categories.reduce((s, c) => s + c.actual_expense, 0);
    return { ...p, categories, totalBudget, totalActual, totalIncome: incomeMap[p.id] || 0 };
  });

  res.json(result);
});

// ─── Físico-Financeiro ──────────────────────────────────────────────────────
router.get('/physical-financial', (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const { project_id } = req.query;

  let projectWhere = "p.status != 'archived'";
  const baseParams: any[] = [today, today];
  if (project_id) {
    projectWhere += ' AND p.id = ?';
    baseParams.push(project_id);
  }

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
    WHERE ${projectWhere}
    ORDER BY p.name
  `).all(...baseParams);

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

// ─── Relatório Analítico de Despesas ─────────────────────────────────────────
router.get('/expense-analytical', (req: AuthRequest, res: Response) => {
  const { project_id, start_date, end_date, category_id } = req.query;
  const today = new Date().toISOString().split('T')[0];

  const buildWhere = (alias = 't') => {
    let where = `${alias}.type = 'expense'`;
    const p: any[] = [];
    if (project_id)              { where += ` AND ${alias}.project_id = ?`;  p.push(project_id); }
    if (isValidDate(start_date)) { where += ` AND ${alias}.date >= ?`;       p.push(start_date); }
    if (isValidDate(end_date))   { where += ` AND ${alias}.date <= ?`;       p.push(end_date); }
    if (category_id)             { where += ` AND ${alias}.category_id = ?`; p.push(category_id); }
    return { where, params: p };
  };

  const { where, params } = buildWhere();

  // ── Summary ──────────────────────────────────────────────────────────────
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(t.amount), 0)                                     as total,
      COUNT(*)                                                        as count,
      COUNT(DISTINCT t.project_id)                                   as project_count,
      COUNT(DISTINCT t.vendor)                                       as vendor_count,
      MAX(t.amount)                                                  as max_single,
      COALESCE(SUM(CASE WHEN t.status='pending' THEN t.amount END), 0) as pending_total,
      COALESCE(SUM(CASE WHEN t.status='pending' AND t.due_date IS NOT NULL AND t.due_date < ? THEN t.amount END), 0) as overdue_total
    FROM transactions t
    WHERE ${where}
  `).get(today, ...params) as any;

  // Monthly totals for average calculation
  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', t.date) as month,
      COALESCE(SUM(t.amount), 0) as total,
      COUNT(*) as count
    FROM transactions t
    WHERE ${where}
    GROUP BY month
    ORDER BY month
  `).all(...params) as any[];

  const avgMonthly = monthly.length > 0
    ? monthly.reduce((s, m) => s + m.total, 0) / monthly.length : 0;

  // ── By Category (with parent info) ──────────────────────────────────────
  const byCategory = db.prepare(`
    SELECT
      c.id, c.name, c.color, c.parent_id,
      cp.name as parent_name, cp.color as parent_color,
      COALESCE(SUM(t.amount), 0) as total,
      COUNT(t.id) as count,
      COALESCE(MAX(t.amount), 0) as max_single,
      COALESCE(SUM(CASE WHEN t.status='pending' THEN t.amount END), 0) as pending,
      strftime('%Y-%m', MAX(t.date)) as last_transaction
    FROM categories c
    LEFT JOIN categories cp ON cp.id = c.parent_id
    LEFT JOIN transactions t ON t.category_id = c.id AND ${where}
    WHERE c.type = 'expense'
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `).all(...params) as any[];

  // ── Monthly by category (last 12 months) ────────────────────────────────
  const { where: mWhere, params: mParams } = buildWhere();
  const monthlyByCategory = db.prepare(`
    SELECT
      strftime('%Y-%m', t.date) as month,
      c.id as category_id, c.name as category_name, c.color as category_color,
      SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE ${mWhere} AND t.date >= date('now', '-12 months')
    GROUP BY month, c.id
    ORDER BY month, total DESC
  `).all(...mParams) as any[];

  // ── By Vendor (top 20) ────────────────────────────────────────────────────
  const { where: vWhere, params: vParams } = buildWhere();
  const byVendor = db.prepare(`
    SELECT
      COALESCE(t.vendor, '(sem fornecedor)') as vendor,
      COALESCE(SUM(t.amount), 0) as total,
      COUNT(*) as count,
      COALESCE(AVG(t.amount), 0) as avg_amount,
      MAX(t.date) as last_date
    FROM transactions t
    WHERE ${vWhere}
    GROUP BY COALESCE(t.vendor, '(sem fornecedor)')
    ORDER BY total DESC
    LIMIT 20
  `).all(...vParams) as any[];

  // ── By Payment Method ────────────────────────────────────────────────────
  const { where: pmWhere, params: pmParams } = buildWhere();
  const byPaymentMethod = db.prepare(`
    SELECT
      COALESCE(t.payment_method, 'Não informado') as payment_method,
      COALESCE(SUM(t.amount), 0) as total,
      COUNT(*) as count
    FROM transactions t
    WHERE ${pmWhere}
    GROUP BY COALESCE(t.payment_method, 'Não informado')
    ORDER BY total DESC
  `).all(...pmParams) as any[];

  // ── By Project (if no project filter) ────────────────────────────────────
  let byProject: any[] = [];
  if (!project_id) {
    const { where: pjWhere, params: pjParams } = buildWhere();
    byProject = db.prepare(`
      SELECT
        p.id, p.name, p.status, p.total_budget,
        COALESCE(SUM(t.amount), 0) as total,
        COUNT(t.id) as count
      FROM projects p
      LEFT JOIN transactions t ON t.project_id = p.id AND ${pjWhere}
      GROUP BY p.id
      HAVING total > 0
      ORDER BY total DESC
    `).all(...pjParams) as any[];
  }

  // ── Recent transactions detail ────────────────────────────────────────────
  const { where: dtWhere, params: dtParams } = buildWhere();
  const detail = db.prepare(`
    SELECT
      t.id, t.date, t.description, t.amount, t.vendor, t.document_number,
      t.payment_method, t.status, t.due_date, t.notes,
      c.name as category_name, c.color as category_color,
      cp.name as parent_category,
      p.name as project_name
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN categories cp ON cp.id = c.parent_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${dtWhere}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 200
  `).all(...dtParams) as any[];

  res.json({
    summary: { ...summary, avgMonthly },
    monthly,
    byCategory,
    monthlyByCategory,
    byVendor,
    byPaymentMethod,
    byProject,
    detail,
  });
});

export default router;
