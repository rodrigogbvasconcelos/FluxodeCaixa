import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Tag, ChevronRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Category } from '../types';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#84CC16', '#10B981',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
  '#14B8A6', '#F59E0B', '#6366F1', '#64748B', '#DC2626',
];

const emptyForm = { name: '', type: 'expense' as 'income' | 'expense', color: '#3B82F6', icon: 'tag', parent_id: '' };

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const load = () => {
    api.get('/categories').then(r => setCategories(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = (type: 'income' | 'expense', parentId?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, type, parent_id: parentId || '' });
    setModalOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, color: c.color, icon: c.icon, parent_id: c.parent_id || '' });
    setModalOpen(true);
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form);
        toast.success('Categoria atualizada!');
      } else {
        await api.post('/categories', form);
        toast.success('Categoria criada!');
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
      await api.delete(`/categories/${deleteTarget.id}`);
      toast.success('Categoria excluída!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    }
  };

  // Build hierarchical structure
  const buildCategoryTree = (cats: Category[]) => {
    const parentMap = new Map<string, Category[]>();
    const parents: Category[] = [];

    cats.forEach(cat => {
      if (cat.parent_id) {
        if (!parentMap.has(cat.parent_id)) {
          parentMap.set(cat.parent_id, []);
        }
        parentMap.get(cat.parent_id)!.push(cat);
      } else {
        parents.push(cat);
      }
    });

    return parents.map(parent => ({
      ...parent,
      children: parentMap.get(parent.id) || []
    }));
  };

  const shown = categories.filter(c => c.type === tab);
  const categoryTree = buildCategoryTree(shown);

  const renderCategoryItem = (category: Category & { children?: Category[] }, level = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id}>
        <div className={`card hover:shadow-md transition-shadow p-4 ${level > 0 ? 'ml-6 border-l-4 border-gray-200' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(category.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg"
              style={{ background: category.color }}>
              <Tag size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{category.name}</div>
              {category.is_default ? (
                <span className="text-xs text-amber-600">Padrão (editável)</span>
              ) : (
                <span className="text-xs text-blue-500">Personalizada</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openNew(category.type, category.id)} className="flex-1 btn-secondary text-xs py-1.5 justify-center">
              <Plus size={12} /> Subitem
            </button>
            <button onClick={() => openEdit(category)} className="flex-1 btn-secondary text-xs py-1.5 justify-center">
              <Edit2 size={12} /> Editar
            </button>
            <button onClick={() => setDeleteTarget(category)} className="flex-1 btn-danger text-xs py-1.5 justify-center">
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-6">
            {category.children!.map(child => renderCategoryItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="text-gray-500 text-sm">Organize receitas e despesas por categoria</p>
        </div>
        <button onClick={() => openNew(tab)} className="btn-primary">
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'expense', label: 'Despesas' },
          { key: 'income', label: 'Receitas' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-16">
          <Tag size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Nenhuma categoria de {tab === 'expense' ? 'despesa' : 'receita'}</p>
          <button onClick={() => openNew(tab)} className="btn-primary mx-auto"><Plus size={15} /> Adicionar</button>
        </div>
      ) : (
        <div className="space-y-3">
          {categoryTree.map(cat => renderCategoryItem(cat))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Categoria' : 'Nova Categoria'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nome *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="form-label">Tipo</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income' }))}
                className={`flex-1 py-2 text-sm ${form.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600'}`}>
                Receita
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense' }))}
                className={`flex-1 py-2 text-sm ${form.type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`}>
                Despesa
              </button>
            </div>
          </div>
          {!editing && (
            <div>
              <label className="form-label">Categoria Pai (opcional)</label>
              <select
                className="form-input"
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
              >
                <option value="">Nenhuma (categoria principal)</option>
                {categories
                  .filter(c => c.type === form.type && !c.parent_id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Excluir Categoria"
        message={`Excluir a categoria "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir" danger
      />
    </div>
  );
}
