import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, BarChart2, FolderOpen, MapPin, User, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import { Project } from '../types';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d?: string) => { try { return d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-'; } catch { return d || '-'; } };

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Concluído', color: 'bg-blue-100 text-blue-700' },
  suspended: { label: 'Suspenso', color: 'bg-amber-100 text-amber-700' },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-600' },
};

const emptyForm = { name: '', description: '', client: '', address: '', start_date: '', end_date: '', total_budget: '', status: 'active' };

export default function Projects() {
  const { hasRole } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/projects').then(r => setProjects(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '', client: p.client || '',
      address: p.address || '', start_date: p.start_date || '', end_date: p.end_date || '',
      total_budget: String(p.total_budget || ''), status: p.status,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, total_budget: parseFloat(form.total_budget) || 0 };
      if (editing) {
        await api.put(`/projects/${editing.id}`, payload);
        toast.success('Projeto atualizado!');
      } else {
        await api.post('/projects', payload);
        toast.success('Projeto criado!');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${deleteTarget.id}`);
      toast.success('Projeto arquivado');
      load();
    } catch {
      toast.error('Erro ao arquivar projeto');
    }
  };

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
          <p className="text-gray-500 text-sm">{projects.length} projeto(s) cadastrado(s)</p>
        </div>
        {hasRole('admin', 'manager') && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Novo Projeto
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar projeto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input pl-9 py-2"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum projeto encontrado</p>
          {hasRole('admin', 'manager') && (
            <button onClick={openNew} className="btn-primary mt-4 mx-auto">
              <Plus size={16} /> Criar primeiro projeto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const income = p.total_income || 0;
            const expenses = p.total_expenses || 0;
            const budget = p.total_budget || 0;
            const progress = budget > 0 ? Math.min((expenses / budget) * 100, 100) : 0;
            const status = statusLabels[p.status] || statusLabels.active;

            return (
              <div key={p.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    {p.client && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <User size={11} /> {p.client}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {p.address && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                    <MapPin size={11} /> {p.address}
                  </div>
                )}

                {(p.start_date || p.end_date) && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                    <Calendar size={11} /> {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-emerald-50 rounded-lg p-2.5">
                    <div className="text-xs text-emerald-600 font-medium">Receitas</div>
                    <div className="text-sm font-bold text-emerald-700">{fmtCurrency(income)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2.5">
                    <div className="text-xs text-red-600 font-medium">Despesas</div>
                    <div className="text-sm font-bold text-red-700">{fmtCurrency(expenses)}</div>
                  </div>
                </div>

                {budget > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Orçamento utilizado</span>
                      <span>{progress.toFixed(1)}% de {fmtCurrency(budget)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  {hasRole('admin', 'manager') && (
                    <>
                      <button onClick={() => openEdit(p)} className="flex-1 btn-secondary text-xs py-1.5 justify-center">
                        <Edit2 size={13} /> Editar
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="flex-1 btn-danger text-xs py-1.5 justify-center">
                        <Trash2 size={13} /> Arquivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Projeto' : 'Novo Projeto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Nome do Projeto *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">Cliente</label>
              <input className="form-input" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Ativo</option>
                <option value="completed">Concluído</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Endereço / Localização</label>
              <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Data de Início</label>
              <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Previsão de Término</label>
              <input type="date" className="form-input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Orçamento Total (R$)</label>
              <input type="number" step="0.01" min="0" className="form-input" value={form.total_budget}
                onChange={e => setForm(f => ({ ...f, total_budget: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Descrição</label>
              <textarea className="form-input" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Arquivar Projeto"
        message={`Deseja arquivar o projeto "${deleteTarget?.name}"? Os lançamentos serão mantidos.`}
        confirmLabel="Arquivar"
        danger
      />
    </div>
  );
}
