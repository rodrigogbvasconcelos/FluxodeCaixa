import React, { useEffect, useState } from 'react';
import { Save, Trash2, Calculator, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Project, Category, Budget } from '../types';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { BrCurrencyInput } from '../components/UI/BrInput';
import { parseBrCurrency } from '../utils/formatters';

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function Budgets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    api.get('/budgets', { params: { project_id: selectedProject } }).then(r => {
      setBudgets(r.data);
      const amounts: Record<string, string> = {};
      r.data.forEach((b: Budget) => {
        // Display stored number as Brazilian format
        amounts[b.category_id] = String(b.amount).replace('.', ',');
      });
      setBudgetAmounts(amounts);
    });
    api.get('/budgets/comparison', { params: { project_id: selectedProject } }).then(r => setComparison(r.data));
  }, [selectedProject]);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const handleSave = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(budgetAmounts)
          .filter(([, v]) => v !== '' && parseBrCurrency(v) > 0)
          .map(([category_id, amount]) =>
            api.post('/budgets', { project_id: selectedProject, category_id, amount: parseBrCurrency(amount) })
          )
      );
      toast.success('Orçamentos salvos!');
      api.get('/budgets/comparison', { params: { project_id: selectedProject } }).then(r => setComparison(r.data));
    } catch {
      toast.error('Erro ao salvar orçamentos');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/budgets/${deleteTarget.id}`);
      toast.success('Orçamento removido');
      setBudgetAmounts(a => { const n = { ...a }; delete n[deleteTarget.category_id]; return n; });
      setBudgets(b => b.filter(x => x.id !== deleteTarget.id));
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const totalBudget = Object.values(budgetAmounts).reduce((s, v) => s + parseBrCurrency(v), 0);
  const project = projects.find(p => p.id === selectedProject);

  // Global totals for comparison
  const expenseComparison = comparison.filter(c => c.type === 'expense' && (c.budget > 0 || c.actual > 0));
  const incomeComparison = comparison.filter(c => c.type === 'income' && (c.budget > 0 || c.actual > 0));
  const totalBudgeted = expenseComparison.reduce((s, c) => s + c.budget, 0);
  const totalActual = expenseComparison.reduce((s, c) => s + c.actual, 0);
  const totalDiff = totalBudgeted - totalActual;
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : null;
  const totalIncome = incomeComparison.reduce((s, c) => s + c.actual, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orçamentos por Projeto</h1>
        <p className="text-gray-500 text-sm">Defina o orçamento por categoria e acompanhe o realizado</p>
      </div>

      {/* Project selector */}
      <div className="card p-4">
        <label className="form-label">Selecionar Projeto</label>
        <select className="form-input max-w-sm" value={selectedProject}
          onChange={e => { setSelectedProject(e.target.value); setBudgetAmounts({}); }}>
          <option value="">Selecione um projeto...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selectedProject && (
        <>
          {/* Budget editor - Expenses */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Orçamento por Categoria (Despesas)</h3>
                <p className="text-xs text-gray-500">Orçamento global do projeto: {fmtCurrency(project?.total_budget || 0)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Total orçado: <strong>{fmtCurrency(totalBudget)}</strong></span>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {expenseCategories.map(cat => {
                const budget = budgets.find(b => b.category_id === cat.id);
                const actual = comparison.find(c => c.id === cat.id)?.actual || 0;
                const budgetVal = parseBrCurrency(budgetAmounts[cat.id] || '0');
                const progress = budgetVal > 0 ? Math.min((actual / budgetVal) * 100, 100) : 0;
                const overBudget = actual > budgetVal && budgetVal > 0;

                return (
                  <div key={cat.id} className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      <span className="text-sm font-medium text-gray-800 flex-1">{cat.name}</span>
                      {budget && (
                        <button onClick={() => setDeleteTarget(budget)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                      <BrCurrencyInput
                        value={budgetAmounts[cat.id] || ''}
                        onChange={v => setBudgetAmounts(a => ({ ...a, [cat.id]: v }))}
                        className="form-input pl-7 text-sm py-2"
                      />
                    </div>
                    {budgetVal > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Realizado: {fmtCurrency(actual)}</span>
                          <span className={overBudget ? 'text-red-500 font-medium' : 'text-gray-400'}>
                            {progress.toFixed(0)}%{overBudget && ' ⚠'}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${overBudget ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comparison table */}
          {comparison.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calculator size={16} /> Comparativo Orçado vs. Realizado
              </h3>

              {/* Global summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-xs text-blue-600 font-medium mb-1">Total Orçado (Despesas)</div>
                  <div className="text-base font-bold text-blue-700">{fmtCurrency(totalBudgeted)}</div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="text-xs text-red-600 font-medium mb-1">Total Gasto</div>
                  <div className="text-base font-bold text-red-700">{fmtCurrency(totalActual)}</div>
                  {totalPct !== null && (
                    <div className={`text-xs mt-0.5 ${totalActual > totalBudgeted ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                      {totalPct.toFixed(1)}% do orçado
                    </div>
                  )}
                </div>
                <div className={`border rounded-xl p-3 ${totalDiff >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                  <div className={`text-xs font-medium mb-1 ${totalDiff >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                    Saldo do Orçamento
                  </div>
                  <div className={`text-base font-bold flex items-center gap-1 ${totalDiff >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {totalDiff >= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                    {totalDiff >= 0 ? '+' : ''}{fmtCurrency(totalDiff)}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <div className="text-xs text-emerald-600 font-medium mb-1">Total Receitas</div>
                  <div className="text-base font-bold text-emerald-700">{fmtCurrency(totalIncome)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Resultado: {fmtCurrency(totalIncome - totalActual)}
                  </div>
                </div>
              </div>

              {/* Global progress bar */}
              {totalBudgeted > 0 && (
                <div className="mb-5 p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-1.5">
                      <BarChart2 size={14} /> Utilização Global do Orçamento
                    </span>
                    <span className={`font-semibold ${totalActual > totalBudgeted ? 'text-red-600' : totalPct! > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {totalPct?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${totalActual > totalBudgeted ? 'bg-red-500' : totalPct! > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min((totalActual / totalBudgeted) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>R$ 0</span>
                    <span>{fmtCurrency(totalBudgeted)}</span>
                  </div>
                </div>
              )}

              {/* By category table */}
              {expenseComparison.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Por Categoria</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase">Categoria</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Orçado</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Realizado</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Diferença</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {expenseComparison.map((c: any) => {
                          const diff = c.budget - c.actual;
                          const pct = c.budget > 0 ? (c.actual / c.budget) * 100 : null;
                          const over = c.actual > c.budget && c.budget > 0;

                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="py-2.5 px-3">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                                  {c.name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">{fmtCurrency(c.budget)}</td>
                              <td className={`py-2.5 px-3 text-right font-medium ${over ? 'text-red-600' : 'text-gray-900'}`}>
                                {fmtCurrency(c.actual)}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {diff >= 0 ? '+' : ''}{fmtCurrency(diff)}
                              </td>
                              <td className={`py-2.5 px-3 text-right ${over ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                {pct !== null ? `${pct.toFixed(1)}%` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Total row */}
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                          <td className="py-2.5 px-3 text-gray-700">TOTAL</td>
                          <td className="py-2.5 px-3 text-right text-gray-700">{fmtCurrency(totalBudgeted)}</td>
                          <td className={`py-2.5 px-3 text-right ${totalActual > totalBudgeted ? 'text-red-600' : 'text-gray-700'}`}>
                            {fmtCurrency(totalActual)}
                          </td>
                          <td className={`py-2.5 px-3 text-right ${totalDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {totalDiff >= 0 ? '+' : ''}{fmtCurrency(totalDiff)}
                          </td>
                          <td className={`py-2.5 px-3 text-right ${totalActual > totalBudgeted ? 'text-red-600' : 'text-gray-700'}`}>
                            {totalPct !== null ? `${totalPct.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Income realized */}
              {incomeComparison.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Receitas Realizadas</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs text-gray-500 uppercase">Categoria</th>
                          <th className="text-right py-2 px-3 text-xs text-gray-500 uppercase">Realizado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {incomeComparison.map((c: any) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="py-2.5 px-3">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                                {c.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                              {fmtCurrency(c.actual)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                          <td className="py-2.5 px-3 text-gray-700">TOTAL RECEITAS</td>
                          <td className="py-2.5 px-3 text-right text-emerald-600">{fmtCurrency(totalIncome)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!selectedProject && (
        <div className="card text-center py-16">
          <Calculator size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Selecione um projeto para gerenciar orçamentos</p>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteBudget}
        title="Remover Orçamento"
        message={`Remover orçamento da categoria "${deleteTarget?.category_name}"?`}
        confirmLabel="Remover" danger
      />
    </div>
  );
}
