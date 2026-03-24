import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Project, Category, Budget } from '../types';
import ConfirmDialog from '../components/UI/ConfirmDialog';

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
      r.data.forEach((b: Budget) => { amounts[b.category_id] = String(b.amount); });
      setBudgetAmounts(amounts);
    });
    api.get('/budgets/comparison', { params: { project_id: selectedProject } }).then(r => setComparison(r.data));
  }, [selectedProject]);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const handleSave = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(budgetAmounts)
          .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
          .map(([category_id, amount]) =>
            api.post('/budgets', { project_id: selectedProject, category_id, amount: parseFloat(amount) })
          )
      );
      toast.success('Orçamentos salvos!');
      // Reload comparison
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

  const totalBudget = Object.values(budgetAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const project = projects.find(p => p.id === selectedProject);

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
          {/* Budget editor */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Orçamento por Categoria</h3>
                <p className="text-xs text-gray-500">Orçamento global: {fmtCurrency(project?.total_budget || 0)}</p>
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
                const budgetVal = parseFloat(budgetAmounts[cat.id] || '0') || 0;
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
                      <input
                        type="number" step="0.01" min="0" placeholder="0,00"
                        value={budgetAmounts[cat.id] || ''}
                        onChange={e => setBudgetAmounts(a => ({ ...a, [cat.id]: e.target.value }))}
                        className="form-input pl-7 text-sm py-2"
                      />
                    </div>
                    {budgetVal > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Realizado: {fmtCurrency(actual)}</span>
                          <span className={overBudget ? 'text-red-500 font-medium' : 'text-gray-400'}>
                            {progress.toFixed(0)}%{overBudget && ' ⚠️'}
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
                    {comparison.filter(c => c.type === 'expense' && (c.budget > 0 || c.actual > 0)).map((c: any) => {
                      const diff = c.budget - c.actual;
                      const pct = c.budget > 0 ? (c.actual / c.budget) * 100 : null;
                      const over = c.actual > c.budget && c.budget > 0;

                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
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
                  </tbody>
                </table>
              </div>
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
