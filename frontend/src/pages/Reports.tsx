import React, { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, FileText as FilePdf, BarChart2, TrendingUp, TrendingDown, AlertCircle, Package, Users, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import { Transaction, Project } from '../types';
import { exportToExcel, exportToPDF, exportBudgetComparisonToExcel } from '../services/export';

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtCompact = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
const fmtMonth = (m: string) => { try { return format(new Date(m + '-01'), 'MMM/yy', { locale: ptBR }); } catch { return m; } };
const fmtDate = (value?: string) => {
  if (!value) return '-';
  try { return format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return value; }
};

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [budgetData, setBudgetData] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [forecastSummary, setForecastSummary] = useState<any>(null);
  const [analyticalData, setAnalyticalData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'cash-flow' | 'budget' | 'financial' | 'forecast' | 'analytical'>('cash-flow');
  const [filters, setFilters] = useState({
    project_id: '', type: '', start_date: '', end_date: ''
  });

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
  }, []);

  const loadReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.type) params.type = filters.type;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;

    api.get('/reports/transactions', { params }).then(r => {
      setTransactions(r.data.transactions);
      setSummary(r.data.summary);
    }).finally(() => setLoading(false));
  }, [filters]);

  const loadBudgetReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (filters.project_id) params.project_id = filters.project_id;
    api.get('/reports/budget-comparison', { params }).then(r => setBudgetData(r.data)).finally(() => setLoading(false));
  }, [filters.project_id]);

  const loadFinancialReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (filters.project_id) params.project_id = filters.project_id;
    api.get('/reports/physical-financial', { params }).then(r => setFinancialData(r.data)).finally(() => setLoading(false));
  }, [filters.project_id]);

  const loadForecastReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (filters.project_id) params.project_id = filters.project_id;
    api.get('/reports/forecast', { params }).then(r => {
      setForecastData(r.data.forecast || []);
      setForecastSummary({
        avgIncome: r.data.avgIncome,
        avgExpense: r.data.avgExpense,
        totalPendingIncome: r.data.totalPendingIncome,
        totalPendingExpense: r.data.totalPendingExpense,
        overdue: r.data.overdue,
        pendingList: r.data.pendingList || [],
      });
    }).finally(() => setLoading(false));
  }, [filters.project_id]);

  const loadAnalyticalReport = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    api.get('/reports/expense-analytical', { params })
      .then(r => setAnalyticalData(r.data))
      .finally(() => setLoading(false));
  }, [filters.project_id, filters.start_date, filters.end_date]);

  useEffect(() => {
    if (tab === 'cash-flow') loadReport();
    else if (tab === 'budget') loadBudgetReport();
    else if (tab === 'financial') loadFinancialReport();
    else if (tab === 'forecast') loadForecastReport();
    else loadAnalyticalReport();
  }, [tab, loadReport, loadBudgetReport, loadFinancialReport, loadForecastReport, loadAnalyticalReport]);

  const handleExcelExport = async () => {
    if (tab === 'cash-flow') {
      await exportToExcel(transactions, 'fluxo_de_caixa', summary ? {
        totalIncome: summary.total_income, totalExpenses: summary.total_expenses,
        balance: summary.total_income - summary.total_expenses
      } : undefined);
      toast.success('Excel exportado!');
    } else if (tab === 'budget') {
      await exportBudgetComparisonToExcel(budgetData, 'comparativo_orcamento');
      toast.success('Excel exportado!');
    }
  };

  const handlePDFExport = () => {
    const project = projects.find(p => p.id === filters.project_id);
    if (tab === 'cash-flow') {
      exportToPDF(transactions, 'Relatório de Fluxo de Caixa',
        summary ? { totalIncome: summary.total_income, totalExpenses: summary.total_expenses, balance: summary.total_income - summary.total_expenses } : undefined,
        project?.name
      );
      toast.success('PDF exportado!');
    }
  };

  const forecastChartData = forecastData.map((item: any) => ({
    month: fmtMonth(item.month), income: item.income, expense: item.expense
  }));

  let cumulated = 0;
  const forecastTrendData = forecastData.map((item: any) => {
    const balance = (item.income || 0) - (item.expense || 0);
    cumulated += balance;
    return {
      month: fmtMonth(item.month),
      income: item.income,
      expense: item.expense,
      balance,
      cumulativeBalance: cumulated,
    };
  });

  const forecastTotalIncome = forecastData.reduce((sum: number, item: any) => sum + (item.income || 0), 0);
  const forecastTotalExpense = forecastData.reduce((sum: number, item: any) => sum + (item.expense || 0), 0);
  const forecastNet = forecastTotalIncome - forecastTotalExpense;
  const bestForecastMonth = forecastTrendData.reduce((best: any, item: any) => !best || item.balance > best.balance ? item : best, null);
  const worstForecastMonth = forecastTrendData.reduce((worst: any, item: any) => !worst || item.balance < worst.balance ? item : worst, null);

  const monthlyMap: Record<string, { income: number; expense: number }> = {};
  transactions.forEach(t => {
    const m = t.date.slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expense: 0 };
    if (t.type === 'income') monthlyMap[m].income += t.amount;
    else monthlyMap[m].expense += t.amount;
  });
  const monthlyData = Object.entries(monthlyMap).sort().map(([month, v]) => ({
    month: fmtMonth(month), ...v, balance: v.income - v.expense
  }));

  const catMap: Record<string, { name: string; color: string; income: number; expense: number }> = {};
  transactions.forEach(t => {
    if (!catMap[t.category_id]) catMap[t.category_id] = { name: t.category_name || '', color: t.category_color || '#6B7280', income: 0, expense: 0 };
    if (t.type === 'income') catMap[t.category_id].income += t.amount;
    else catMap[t.category_id].expense += t.amount;
  });
  const expenseByCat = Object.values(catMap).filter(c => c.expense > 0).sort((a, b) => b.expense - a.expense);
  const incomeByCat = Object.values(catMap).filter(c => c.income > 0).sort((a, b) => b.income - a.income);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm">Análise detalhada do fluxo financeiro</p>
        </div>
        <div className="flex gap-2">
          {(tab === 'cash-flow' || tab === 'budget') && (
            <button onClick={handleExcelExport} className="btn-success text-sm">
              <FileSpreadsheet size={15} /> Excel
            </button>
          )}
          {tab === 'cash-flow' && (
            <button onClick={handlePDFExport} className="btn-danger text-sm">
              <FilePdf size={15} /> PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap border-b border-gray-200 gap-1">
        {[
          { key: 'cash-flow', label: 'Fluxo de Caixa' },
          { key: 'budget', label: 'Orçado vs Realizado' },
          { key: 'financial', label: 'Físico-Financeiro' },
          { key: 'forecast', label: 'Previsão' },
          { key: 'analytical', label: 'Analítico Despesas' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <select className="form-input py-2 text-sm min-w-[180px]" value={filters.project_id}
            onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}>
            <option value="">Todos os projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {tab === 'cash-flow' && (
            <select className="form-input py-2 text-sm min-w-[130px]" value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
          )}
          {(tab === 'cash-flow' || tab === 'analytical') && (
            <>
              <input type="date" className="form-input py-2 text-sm" value={filters.start_date}
                onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
              <input type="date" className="form-input py-2 text-sm" value={filters.end_date}
                onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Carregando relatório...</div>
      ) : tab === 'cash-flow' ? (
        <>
          {summary && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                  <TrendingUp size={18} />
                  <span className="text-sm font-medium">Total Receitas</span>
                </div>
                <div className="text-2xl font-bold text-emerald-700">{fmtCurrency(summary.total_income)}</div>
                <div className="text-xs text-emerald-500">{summary.count} lançamentos</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <TrendingDown size={18} />
                  <span className="text-sm font-medium">Total Despesas</span>
                </div>
                <div className="text-2xl font-bold text-red-700">{fmtCurrency(summary.total_expenses)}</div>
              </div>
              <div className={`border rounded-xl p-4 ${summary.total_income - summary.total_expenses >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className={`flex items-center gap-2 mb-1 ${summary.total_income - summary.total_expenses >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  <BarChart2 size={18} />
                  <span className="text-sm font-medium">Saldo</span>
                </div>
                <div className={`text-2xl font-bold ${summary.total_income - summary.total_expenses >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {fmtCurrency(summary.total_income - summary.total_expenses)}
                </div>
              </div>
            </div>
          )}

          {monthlyData.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="balance" name="Saldo" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Despesas por Categoria</h3>
              {expenseByCat.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expenseByCat} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Bar dataKey="expense" name="Despesa" radius={[0, 4, 4, 0]}>
                      {expenseByCat.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-center py-12 text-gray-400 text-sm">Sem dados</div>}
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Receitas por Categoria</h3>
              {incomeByCat.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={incomeByCat} dataKey="income" nameKey="name" cx="50%" cy="45%" outerRadius={80}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {incomeByCat.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="text-center py-12 text-gray-400 text-sm">Sem dados</div>}
            </div>
          </div>

          {transactions.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Lançamentos ({transactions.length})</h3>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projeto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-4 py-2.5 text-gray-700">{t.project_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ background: t.category_color || '#6B7280' }} />
                            {t.category_name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{t.description}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'expense' ? '-' : '+'}{fmtCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : tab === 'budget' ? (
        <div className="space-y-5">
          {budgetData.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">Nenhum dado de orçamento encontrado</div>
          ) : budgetData.map((proj: any) => (
            <div key={proj.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{proj.name}</h3>
                  {proj.client && <p className="text-xs text-gray-500">{proj.client}</p>}
                </div>
                <div className="text-right text-sm">
                  <div>Orçado: <strong>{fmtCurrency(proj.totalBudget)}</strong></div>
                  <div>Realizado: <strong className={proj.totalActual > proj.totalBudget ? 'text-red-600' : 'text-gray-900'}>
                    {fmtCurrency(proj.totalActual)}
                  </strong></div>
                  <div className={`text-xs font-medium mt-0.5 ${proj.totalBudget - proj.totalActual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {proj.totalBudget > 0 ? `${((proj.totalActual / proj.totalBudget) * 100).toFixed(1)}% utilizado` : ''}
                  </div>
                </div>
              </div>

              {proj.totalBudget > 0 && (
                <div className="mb-4">
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        proj.totalActual > proj.totalBudget ? 'bg-red-500' :
                        proj.totalActual / proj.totalBudget > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min((proj.totalActual / proj.totalBudget) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs text-gray-500 uppercase">Categoria</th>
                    <th className="text-right py-2 text-xs text-gray-500 uppercase">Orçado</th>
                    <th className="text-right py-2 text-xs text-gray-500 uppercase">Realizado</th>
                    <th className="text-right py-2 text-xs text-gray-500 uppercase">Diferença</th>
                    <th className="text-right py-2 text-xs text-gray-500 uppercase">Uso %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {proj.categories.filter((c: any) => c.budget > 0 || c.actual_expense > 0).map((c: any) => {
                    const diff = c.budget - c.actual_expense;
                    const pct = c.budget > 0 ? (c.actual_expense / c.budget) * 100 : null;
                    const over = c.actual_expense > c.budget && c.budget > 0;

                    return (
                      <tr key={c.id} className={`hover:bg-gray-50 ${over ? 'bg-red-50/50' : ''}`}>
                        <td className="py-2">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                            {c.name}
                          </span>
                        </td>
                        <td className="py-2 text-right text-gray-600">{fmtCurrency(c.budget)}</td>
                        <td className={`py-2 text-right font-medium ${over ? 'text-red-600' : 'text-gray-900'}`}>
                          {fmtCurrency(c.actual_expense)}
                        </td>
                        <td className={`py-2 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {diff >= 0 ? '+' : ''}{fmtCurrency(diff)}
                        </td>
                        <td className={`py-2 text-right ${over ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          {pct !== null ? `${pct.toFixed(1)}%` : '-'}
                          {over && ' ⚠️'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : tab === 'financial' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Receitas acumuladas</div>
              <div className="text-2xl font-bold text-emerald-700">{fmtCurrency(financialData.reduce((sum, item) => sum + (item.total_income || 0), 0))}</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Despesas acumuladas</div>
              <div className="text-2xl font-bold text-red-700">{fmtCurrency(financialData.reduce((sum, item) => sum + (item.total_expenses || 0), 0))}</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Orçamento previsto</div>
              <div className="text-2xl font-bold text-blue-700">{fmtCurrency(financialData.reduce((sum, item) => sum + (item.total_budgeted || 0), 0))}</div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Pendências</div>
              <div className="text-2xl font-bold text-orange-700">{fmtCurrency(financialData.reduce((sum, item) => sum + (item.pending_expenses || 0) + (item.pending_income || 0), 0))}</div>
            </div>
          </div>

          {financialData.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">Nenhum projeto encontrado</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projeto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Orçamento</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Receitas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Despesas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendências</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vencidas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Burn Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {financialData.map((proj: any) => (
                    <tr key={proj.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{proj.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtCurrency(proj.total_budgeted || 0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmtCurrency(proj.total_income || 0)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmtCurrency(proj.total_expenses || 0)}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{fmtCurrency((proj.pending_expenses || 0) + (proj.pending_income || 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{fmtCurrency(proj.overdue_expenses || 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{proj.burnRate ? `${proj.burnRate.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}` : '-'} /mês</td>
                      <td className="px-4 py-3 text-right text-gray-700">{proj.cpi ? proj.cpi.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'forecast' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="text-xs text-emerald-600 uppercase tracking-wide mb-2">Média receitas 6m</div>
              <div className="text-2xl font-bold text-emerald-700">{fmtCurrency(forecastSummary?.avgIncome || 0)}</div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="text-xs text-red-600 uppercase tracking-wide mb-2">Média despesas 6m</div>
              <div className="text-2xl font-bold text-red-700">{fmtCurrency(forecastSummary?.avgExpense || 0)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-xs text-blue-600 uppercase tracking-wide mb-2">Total a receber</div>
              <div className="text-2xl font-bold text-blue-700">{fmtCurrency(forecastSummary?.totalPendingIncome || 0)}</div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <div className="text-xs text-orange-600 uppercase tracking-wide mb-2">Total a pagar</div>
              <div className="text-2xl font-bold text-orange-700">{fmtCurrency(forecastSummary?.totalPendingExpense || 0)}</div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="text-xs text-emerald-600 uppercase tracking-wide mb-2">Receita prevista</div>
                <div className="text-2xl font-bold text-emerald-700">{fmtCurrency(forecastTotalIncome)}</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="text-xs text-red-600 uppercase tracking-wide mb-2">Despesa prevista</div>
                <div className="text-2xl font-bold text-red-700">{fmtCurrency(forecastTotalExpense)}</div>
              </div>
              <div className={`bg-blue-50 border border-blue-100 rounded-xl p-4`}> 
                <div className="text-xs text-blue-600 uppercase tracking-wide mb-2">Saldo líquido previsto</div>
                <div className="text-2xl font-bold text-blue-700">{fmtCurrency(forecastNet)}</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Mês melhor / pior</div>
                <div className="text-sm text-gray-700">{bestForecastMonth ? `${bestForecastMonth.month} +${fmtCurrency(bestForecastMonth.balance)}` : '-'}</div>
                <div className="text-sm text-gray-500">{worstForecastMonth ? `${worstForecastMonth.month} ${fmtCurrency(worstForecastMonth.balance)}` : ''}</div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Previsão por mês</h3>
              {forecastTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={forecastTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => fmtCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Receitas" fill="#10b981" />
                    <Bar dataKey="expense" name="Despesas" fill="#ef4444" />
                    <Line type="monotone" dataKey="balance" name="Saldo Líquido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumulativeBalance" name="Saldo Acumulado" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-16 text-gray-400">Nenhum dado de previsão disponível</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Contas pendentes</h3>
                <p className="text-xs text-gray-500">Últimos lançamentos pendentes com vencimento</p>
              </div>
              <div className="text-xs text-gray-500">
                Vencidas: {forecastSummary?.overdue?.count || 0} | Valor: {fmtCurrency(forecastSummary?.overdue?.expense || 0)}
              </div>
            </div>
            {forecastSummary?.pendingList?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Projeto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {forecastSummary.pendingList.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(item.due_date)}</td>
                        <td className="px-4 py-3 text-gray-700">{item.project_name}</td>
                        <td className="px-4 py-3 text-gray-700">{item.category_name}</td>
                        <td className="px-4 py-3 text-gray-700">{item.description}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">{fmtCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">Nenhuma conta pendente encontrada</div>
            )}
          </div>
        </div>
      ) : tab === 'analytical' ? (
        <div className="space-y-5">
          {!analyticalData ? (
            <div className="card text-center py-16 text-gray-400">Nenhum dado encontrado</div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="text-xs text-red-500 font-medium uppercase tracking-wide mb-1">Total Despesas</div>
                  <div className="text-lg font-bold text-red-700">{fmtCurrency(analyticalData.summary.total)}</div>
                  <div className="text-xs text-gray-400">{analyticalData.summary.count} lançamentos</div>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="text-xs text-orange-500 font-medium uppercase tracking-wide mb-1">Média Mensal</div>
                  <div className="text-lg font-bold text-orange-700">{fmtCurrency(analyticalData.summary.avgMonthly)}</div>
                  <div className="text-xs text-gray-400">{analyticalData.monthly.length} meses</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-1">Maior Lançamento</div>
                  <div className="text-lg font-bold text-amber-700">{fmtCurrency(analyticalData.summary.max_single)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
                    <Users size={11} /> Fornecedores
                  </div>
                  <div className="text-lg font-bold text-slate-700">{analyticalData.summary.vendor_count}</div>
                  <div className="text-xs text-gray-400">{analyticalData.summary.project_count} obras</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-xs text-yellow-600 font-medium uppercase tracking-wide mb-1">
                    <AlertCircle size={11} /> Pendentes
                  </div>
                  <div className="text-lg font-bold text-yellow-700">{fmtCurrency(analyticalData.summary.pending_total)}</div>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-xs text-rose-600 font-medium uppercase tracking-wide mb-1">
                    <AlertCircle size={11} /> Vencidas
                  </div>
                  <div className="text-lg font-bold text-rose-700">{fmtCurrency(analyticalData.summary.overdue_total)}</div>
                </div>
              </div>

              {/* By Category + Monthly Evolution side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* By Category bar */}
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package size={15} /> Despesas por Categoria
                  </h3>
                  {analyticalData.byCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(220, analyticalData.byCategory.length * 26)}>
                      <BarChart data={analyticalData.byCategory.map((c: any) => ({ ...c, pct: analyticalData.summary.total > 0 ? (c.total / analyticalData.summary.total * 100).toFixed(1) : 0 }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={fmtCompact} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v: number, _: any, props: any) => [
                            `${fmtCurrency(v)} (${props.payload.pct}%)`,
                            'Total'
                          ]}
                        />
                        <Bar dataKey="total" name="Despesa" radius={[0, 4, 4, 0]}>
                          {analyticalData.byCategory.map((c: any, i: number) => (
                            <Cell key={i} fill={c.color || '#6B7280'} fillOpacity={c.parent_id ? 0.65 : 1} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center py-12 text-gray-400 text-sm">Sem dados</div>}
                </div>

                {/* Monthly evolution */}
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4">Evolução Mensal de Despesas</h3>
                  {analyticalData.monthly.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={analyticalData.monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtCurrency(v)} labelFormatter={fmtMonth} />
                        <Bar dataKey="total" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        <Line type="monotone" dataKey="total" name="Tendência" stroke="#b91c1c" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <div className="text-center py-12 text-gray-400 text-sm">Sem dados</div>}
                </div>
              </div>

              {/* By Vendor + By Payment Method side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Top vendors */}
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users size={15} /> Top Fornecedores
                  </h3>
                  {analyticalData.byVendor.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 text-xs text-gray-500 uppercase">#</th>
                            <th className="text-left py-2 text-xs text-gray-500 uppercase">Fornecedor</th>
                            <th className="text-right py-2 text-xs text-gray-500 uppercase">Total</th>
                            <th className="text-right py-2 text-xs text-gray-500 uppercase">Lançamentos</th>
                            <th className="text-right py-2 text-xs text-gray-500 uppercase">% Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {analyticalData.byVendor.map((v: any, i: number) => {
                            const pct = analyticalData.summary.total > 0
                              ? (v.total / analyticalData.summary.total * 100).toFixed(1) : '0.0';
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="py-2 text-xs text-gray-400">{i + 1}</td>
                                <td className="py-2 text-gray-700 truncate max-w-[180px]">{v.vendor}</td>
                                <td className="py-2 text-right font-medium text-red-700">{fmtCurrency(v.total)}</td>
                                <td className="py-2 text-right text-gray-500">{v.count}</td>
                                <td className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(Number(pct), 100)}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="text-center py-8 text-gray-400 text-sm">Sem dados</div>}
                </div>

                {/* By payment method */}
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard size={15} /> Por Forma de Pagamento
                  </h3>
                  {analyticalData.byPaymentMethod.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={analyticalData.byPaymentMethod} dataKey="total" nameKey="payment_method"
                            cx="50%" cy="50%" outerRadius={70}
                            label={({ payment_method, percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={false}>
                            {analyticalData.byPaymentMethod.map((_: any, i: number) => (
                              <Cell key={i} fill={['#ef4444','#f97316','#eab308','#84cc16','#06b6d4','#8b5cf6','#ec4899'][i % 7]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-2 divide-y divide-gray-50">
                        {analyticalData.byPaymentMethod.map((pm: any, i: number) => (
                          <div key={i} className="py-2 flex justify-between text-sm">
                            <span className="text-gray-700">{pm.payment_method}</span>
                            <span className="font-medium text-red-700">{fmtCurrency(pm.total)} ({pm.count})</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <div className="text-center py-8 text-gray-400 text-sm">Sem dados</div>}
                </div>
              </div>

              {/* By Project (shown when no project filter) */}
              {analyticalData.byProject?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart2 size={15} /> Despesas por Obra
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase">Obra</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Total Despesas</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Lançamentos</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">% do Total</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Vs Orçamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {analyticalData.byProject.map((proj: any) => {
                          const pct = analyticalData.summary.total > 0
                            ? (proj.total / analyticalData.summary.total * 100).toFixed(1) : '0.0';
                          const vsBudget = proj.total_budget > 0
                            ? (proj.total / proj.total_budget * 100).toFixed(1) : null;
                          return (
                            <tr key={proj.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-3 text-gray-700 font-medium">{proj.name}</td>
                              <td className="py-2.5 px-3 text-right font-medium text-red-700">{fmtCurrency(proj.total)}</td>
                              <td className="py-2.5 px-3 text-right text-gray-500">{proj.count}</td>
                              <td className="py-2.5 px-3 text-right text-gray-600">{pct}%</td>
                              <td className={`py-2.5 px-3 text-right text-sm font-medium ${vsBudget && Number(vsBudget) > 100 ? 'text-red-600' : vsBudget && Number(vsBudget) > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {vsBudget ? `${vsBudget}%` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detail table */}
              <div className="card p-0 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    Detalhe de Lançamentos ({analyticalData.detail?.length})
                  </h3>
                  <span className="text-xs text-gray-400">Últimos 200 registros</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Data</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Obra</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Pagamento</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {analyticalData.detail?.map((t: any) => (
                        <tr key={t.id} className={`hover:bg-gray-50 ${t.status === 'pending' ? 'bg-yellow-50/30' : ''}`}>
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-[120px] truncate">{t.project_name}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              {t.parent_category && (
                                <span className="text-[10px] text-gray-400 leading-none">{t.parent_category}</span>
                              )}
                              <span className="flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color || '#6B7280' }} />
                                {t.category_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-[120px] truncate">{t.vendor || '-'}</td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-[160px] truncate">{t.description}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{t.payment_method || '-'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {t.status === 'pending' ? 'Pendente' : 'Pago'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-red-700">{fmtCurrency(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
