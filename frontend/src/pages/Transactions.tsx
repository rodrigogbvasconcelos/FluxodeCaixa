import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Plus, Search, Edit2, Trash2, Filter, FileText,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ChevronDown, Paperclip, X,
  Download, Eye, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import { Transaction, Project, Category } from '../types';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { BrDateInput, BrCurrencyInput } from '../components/UI/BrInput';
import ContactSearch from '../components/UI/ContactSearch';
import { parseBrCurrency } from '../utils/formatters';

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d: string) => { try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; } };

// ── CategorySelect ────────────────────────────────────────────────────────────
// Custom dropdown that groups subcategories under their parent and displays
// the full path ("Parent › Sub") when a subcategory is selected.
// Uses a portal + fixed positioning so the dropdown escapes overflow-y-auto modals.
interface CategorySelectProps {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

function CategorySelect({ categories, value, onChange, required }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = categories.find(c => c.id === value) ?? null;
  const selectedParent = selected?.parent_id
    ? categories.find(c => c.id === selected.parent_id) ?? null
    : null;

  // Filter: if search has text, show all matching items flat; otherwise show hierarchy
  const q = search.toLowerCase().trim();
  const filteredFlat = q
    ? categories.filter(c => c.name.toLowerCase().includes(q))
    : null;
  const parents = filteredFlat ? [] : categories.filter(c => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter(c => c.parent_id === pid);

  const reposition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropStyle({ top: r.bottom + 4, left: r.left, width: r.width, zIndex: 9999, position: 'fixed' });
  };

  const openDropdown = () => {
    setSearch('');
    reposition();
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (id: string) => { onChange(id); setOpen(false); setSearch(''); };

  const Dot = ({ color, size = 10 }: { color: string; size?: number }) => (
    <span className="rounded-full flex-shrink-0 inline-block"
      style={{ width: size, height: size, background: color }} />
  );

  // Name of parent for a category (used in flat search results)
  const parentName = (cat: Category) => {
    if (!cat.parent_id) return null;
    return categories.find(c => c.id === cat.parent_id)?.name ?? null;
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        className="form-input flex items-center justify-between gap-2 text-left w-full min-h-[38px]"
      >
        {selected ? (
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectedParent ? (
              <>
                <Dot color={selectedParent.color} />
                <span className="text-gray-400 text-sm truncate max-w-[80px]">{selectedParent.name}</span>
                <span className="text-gray-300 flex-shrink-0">›</span>
                <Dot color={selected.color} />
                <span className="text-gray-900 text-sm font-medium truncate">{selected.name}</span>
              </>
            ) : (
              <>
                <Dot color={selected.color} />
                <span className="text-gray-900 text-sm font-medium truncate">{selected.name}</span>
              </>
            )}
          </span>
        ) : (
          <span className="text-gray-400 text-sm flex-1">Selecione...</span>
        )}
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {required && (
        <select value={value} onChange={() => {}} required tabIndex={-1} aria-hidden="true"
          className="sr-only absolute bottom-0 left-0 w-full h-0 opacity-0">
          <option value="" />
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {open && ReactDOM.createPortal(
        <div ref={dropdownRef} style={dropStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col max-h-72">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100 flex-shrink-0">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar categoria..."
              className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto flex-1">
            {/* Flat search results */}
            {filteredFlat && (
              filteredFlat.length === 0
                ? <div className="px-4 py-3 text-sm text-gray-400">Nenhuma categoria encontrada</div>
                : filteredFlat.map(cat => {
                    const pName = parentName(cat);
                    return (
                      <button key={cat.id} type="button"
                        onMouseDown={e => { e.preventDefault(); select(cat.id); }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors ${value === cat.id ? 'bg-blue-50' : ''}`}>
                        <Dot color={cat.color} size={pName ? 8 : 10} />
                        <span className="flex-1 min-w-0">
                          {pName && <span className="text-xs text-gray-400 mr-1">{pName} ›</span>}
                          <span className={`text-sm ${pName ? '' : 'font-semibold'} ${value === cat.id ? 'text-blue-700' : 'text-gray-800'}`}>
                            {cat.name}
                          </span>
                        </span>
                        {value === cat.id && <span className="text-[10px] text-blue-500 flex-shrink-0">✓</span>}
                      </button>
                    );
                  })
            )}

            {/* Hierarchical (no search) */}
            {!filteredFlat && (
              parents.length === 0
                ? <div className="px-4 py-3 text-sm text-gray-400">Nenhuma categoria disponível</div>
                : parents.map(parent => {
                    const children = childrenOf(parent.id);
                    return (
                      <div key={parent.id}>
                        <button type="button"
                          onMouseDown={e => { e.preventDefault(); select(parent.id); }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors ${value === parent.id ? 'bg-blue-50' : ''}`}>
                          <Dot color={parent.color} size={10} />
                          <span className={`text-sm font-semibold flex-1 ${value === parent.id ? 'text-blue-700' : 'text-gray-800'}`}>
                            {parent.name}
                          </span>
                          {children.length > 0 && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {children.length}
                            </span>
                          )}
                        </button>
                        {children.map(child => (
                          <button key={child.id} type="button"
                            onMouseDown={e => { e.preventDefault(); select(child.id); }}
                            className={`w-full text-left pl-7 pr-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors ${value === child.id ? 'bg-blue-50' : ''}`}>
                            <span className="text-gray-300 text-xs flex-shrink-0">↳</span>
                            <Dot color={child.color} size={8} />
                            <span className={`text-sm flex-1 ${value === child.id ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                              {child.name}
                            </span>
                            {value === child.id && <span className="text-[10px] text-blue-500 flex-shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const paymentMethods = ['Dinheiro', 'PIX', 'Transferência', 'Boleto', 'Cartão de Débito', 'Cartão de Crédito', 'Cheque'];

const emptyForm = {
  project_id: '', category_id: '', type: 'expense' as 'income' | 'expense',
  amount: '', description: '', vendor: '', document_number: '',
  date: new Date().toISOString().split('T')[0], payment_method: '', notes: '', invoice_id: '',
  due_date: '', payment_date: '', installments: '1',
};

export default function Transactions() {
  const { hasRole } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ search: '', project_id: '', type: '', category_id: '', start_date: '', end_date: '' });
  const [showFilters, setShowFilters] = useState(false);
  // File attachment
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [existingInvoiceName, setExistingInvoiceName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Invoice preview
  const [previewInvoice, setPreviewInvoice] = useState<{ name: string; mime?: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { page, limit: LIMIT };
    if (filters.project_id) params.project_id = filters.project_id;
    if (filters.type) params.type = filters.type;
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;

    api.get('/transactions', { params }).then(r => {
      setTransactions(r.data.data);
      setTotal(r.data.total);
    }).finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(load, [load]);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  // Auto-fill client vendor when income and project changes
  useEffect(() => {
    if (form.type === 'income' && form.project_id && !editing) {
      const project = projects.find(p => p.id === form.project_id);
      if (project?.client) {
        setForm(f => ({ ...f, vendor: project.client! }));
      }
    }
  }, [form.project_id, form.type, projects, editing]);

  const openNew = (type?: 'income' | 'expense') => {
    setEditing(null);
    setForm({ ...emptyForm, type: type || 'expense' });
    setAttachedFile(null);
    setExistingInvoiceName('');
    setModalOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      project_id: t.project_id, category_id: t.category_id, type: t.type,
      amount: String(t.amount).replace('.', ','), description: t.description, vendor: t.vendor || '',
      document_number: t.document_number || '', date: t.date,
      payment_method: t.payment_method || '', notes: t.notes || '', invoice_id: t.invoice_id || '',
      due_date: t.due_date || '', payment_date: t.payment_date || '', installments: '1',
    });
    setAttachedFile(null);
    setExistingInvoiceName(t.invoice_name || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let invoiceId = form.invoice_id;

      // Upload file if attached
      if (attachedFile) {
        const fd = new FormData();
        fd.append('invoice', attachedFile);
        const uploadRes = await api.post('/invoices/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        invoiceId = uploadRes.data.id;
      }

      const payload = {
        ...form,
        amount: parseBrCurrency(form.amount),
        invoice_id: invoiceId || null,
        due_date: form.due_date || null,
        payment_date: form.payment_date || null,
        installments: parseInt(form.installments) || 1,
      };
      if (editing) {
        await api.put(`/transactions/${editing.id}`, payload);
        toast.success('Lançamento atualizado!');
        setModalOpen(false);
      } else {
        await api.post('/transactions', payload);
        toast.success('Lançamento criado! Pronto para novo lançamento.');
        // Keep modal open, reset form preserving type (income/expense)
        setForm({ ...emptyForm, type: form.type, date: new Date().toISOString().split('T')[0] });
        setAttachedFile(null);
        setExistingInvoiceName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
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
      await api.delete(`/transactions/${deleteTarget.id}`);
      toast.success('Lançamento excluído');
      load();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    setExistingInvoiceName('');
    setForm(f => ({ ...f, invoice_id: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openInvoice = async (invoiceId: string, invoiceName: string) => {
    if (previewLoading) return;
    setPreviewLoading(invoiceId);
    try {
      const res = await api.get(`/invoices/${invoiceId}/view`, { responseType: 'blob' });
      const mime = res.headers['content-type'] || '';
      const blob = new Blob([res.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const isPreviewable = mime.includes('pdf') || mime.includes('image');
      if (isPreviewable) {
        setPreviewInvoice({ name: invoiceName, mime, url });
      } else {
        // Non-previewable: force download
        const a = document.createElement('a');
        a.href = url;
        a.download = invoiceName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      toast.error('Erro ao carregar arquivo');
    } finally {
      setPreviewLoading(null);
    }
  };

  const closePreview = () => {
    if (previewInvoice?.url) URL.revokeObjectURL(previewInvoice.url);
    setPreviewInvoice(null);
  };

  const filteredCategories = categories.filter(c => c.type === form.type);

  const totalPages = Math.ceil(total / LIMIT);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lançamentos</h1>
          <p className="text-gray-500 text-sm">{total} lançamento(s)</p>
        </div>
        {hasRole('admin', 'manager', 'operator') && (
          <div className="flex gap-2">
            <button onClick={() => openNew('income')} className="btn-success text-sm">
              <ArrowUpRight size={15} /> Receita
            </button>
            <button onClick={() => openNew('expense')} className="btn-danger text-sm">
              <ArrowDownRight size={15} /> Despesa
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <div className="text-xs text-emerald-600 font-medium">Receitas (página)</div>
          <div className="text-lg font-bold text-emerald-700">{fmtCurrency(totalIncome)}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <div className="text-xs text-red-600 font-medium">Despesas (página)</div>
          <div className="text-lg font-bold text-red-700">{fmtCurrency(totalExpense)}</div>
        </div>
        <div className={`${totalIncome - totalExpense >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'} border rounded-xl p-3`}>
          <div className={`text-xs font-medium ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo (página)</div>
          <div className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {fmtCurrency(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Buscar..." value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="form-input pl-8 py-2 text-sm" />
          </div>
          <select className="form-input py-2 text-sm min-w-[140px]" value={filters.project_id}
            onChange={e => { setFilters(f => ({ ...f, project_id: e.target.value })); setPage(1); }}>
            <option value="">Todos projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-input py-2 text-sm min-w-[120px]" value={filters.type}
            onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
            <option value="">Todos tipos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-sm py-2">
            <Filter size={14} /> {showFilters ? 'Menos' : 'Mais'} filtros
          </button>
        </div>
        {showFilters && (
          <div className="flex gap-3 flex-wrap mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs text-gray-500 whitespace-nowrap">De:</span>
              <BrDateInput className="form-input py-2 text-sm flex-1"
                value={filters.start_date}
                onChange={v => { setFilters(f => ({ ...f, start_date: v })); setPage(1); }} />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-xs text-gray-500 whitespace-nowrap">Até:</span>
              <BrDateInput className="form-input py-2 text-sm flex-1"
                value={filters.end_date}
                onChange={v => { setFilters(f => ({ ...f, end_date: v })); setPage(1); }} />
            </div>
            <button onClick={() => { setFilters({ search: '', project_id: '', type: '', category_id: '', start_date: '', end_date: '' }); setPage(1); }}
              className="btn-secondary text-sm py-2 text-red-500">Limpar</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Projeto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fornecedor/Cliente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                {hasRole('admin', 'manager') && <th className="px-4 py-3 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Nenhum lançamento encontrado</td></tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span className={t.type === 'income' ? 'badge-income' : 'badge-expense'}>
                        {t.type === 'income' ? '↑ Receita' : '↓ Despesa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[150px] truncate">{t.project_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        {(t as any).category_parent_name ? (
                          <>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: (t as any).category_parent_color || '#6B7280' }} />
                            <span className="text-gray-400">{(t as any).category_parent_name}</span>
                            <span className="text-gray-300">›</span>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color || '#6B7280' }} />
                            <span className="font-medium">{t.category_name}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.category_color || '#6B7280' }} />
                            {t.category_name}
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                      <div className="truncate">{t.description}</div>
                      {t.invoice_name && t.invoice_id && (
                        <button
                          onClick={() => openInvoice(t.invoice_id!, t.invoice_name!)}
                          disabled={previewLoading === t.invoice_id}
                          title="Visualizar / baixar anexo"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5 disabled:opacity-50"
                        >
                          {previewLoading === t.invoice_id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <FileText size={10} />}
                          {t.invoice_name}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{t.vendor || '-'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'expense' ? '-' : '+'}{fmtCurrency(t.amount)}
                    </td>
                    {hasRole('admin', 'manager') && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Mostrando {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} de {total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Lançamento' : form.type === 'income' ? 'Nova Receita' : 'Nova Despesa'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Type toggle */}
          {!editing && (
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '', vendor: '' }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                ↑ Receita
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '', vendor: '' }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                ↓ Despesa
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Projeto *</label>
              <select className="form-input" value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} required>
                <option value="">Selecione...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Categoria *</label>
              <CategorySelect
                categories={filteredCategories}
                value={form.category_id}
                onChange={id => setForm(f => ({ ...f, category_id: id }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <BrCurrencyInput className="form-input pl-8" value={form.amount}
                  onChange={v => setForm(f => ({ ...f, amount: v }))} required />
              </div>
            </div>
            <div>
              <label className="form-label">Data *</label>
              <BrDateInput className="form-input" value={form.date}
                onChange={v => setForm(f => ({ ...f, date: v }))} required />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Descrição *</label>
              <input className="form-input" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div>
              <ContactSearch
                label={form.type === 'income'
                  ? `Cliente${form.project_id && projects.find(p => p.id === form.project_id)?.client ? ' (do projeto)' : ''}`
                  : 'Fornecedor'}
                contactType={form.type === 'income' ? 'client' : 'supplier'}
                value={form.vendor}
                onChange={v => setForm(f => ({ ...f, vendor: v }))}
              />
            </div>
            <div>
              <label className="form-label">Nº Documento / NF</label>
              <input className="form-input" value={form.document_number}
                onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Forma de Pagamento</label>
              <select className="form-input" value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                <option value="">Selecione...</option>
                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Data de Vencimento</label>
              <BrDateInput className="form-input" value={form.due_date}
                onChange={v => setForm(f => ({ ...f, due_date: v }))} />
            </div>

            {!editing && (
              <div>
                <label className="form-label">Nº de Parcelas</label>
                <input type="number" min={1} max={60} className="form-input"
                  value={form.installments}
                  onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} />
                {parseInt(form.installments) > 1 && (
                  <p className="text-xs text-blue-600 mt-1">
                    {parseInt(form.installments)}x de {
                      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                        .format(parseBrCurrency(form.amount) / parseInt(form.installments))
                    } — vencimentos mensais a partir da data de vencimento
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="form-label">Data de Pagamento</label>
              <BrDateInput className="form-input" value={form.payment_date}
                onChange={v => setForm(f => ({ ...f, payment_date: v }))} />
              <p className="text-xs text-gray-400 mt-1">
                Deixe em branco para registrar como conta a {form.type === 'expense' ? 'pagar' : 'receber'}
              </p>
            </div>

            {/* File attachment */}
            <div>
              <label className="form-label">Anexo (NF / Recibo / Comprovante)</label>
              {(attachedFile || existingInvoiceName) ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <FileText size={16} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-blue-700 flex-1 truncate">
                    {attachedFile ? attachedFile.name : existingInvoiceName}
                  </span>
                  <button type="button" onClick={removeAttachment}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer p-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <Paperclip size={15} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Clique para anexar arquivo</span>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    onChange={e => setAttachedFile(e.target.files?.[0] || null)} />
                </label>
              )}
              <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG ou TXT (máx. 10MB)</p>
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Observações</label>
              <textarea className="form-input" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving}
              className={form.type === 'income' ? 'btn-success' : 'btn-danger'}>
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Lançar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Excluir Lançamento"
        message={`Deseja excluir o lançamento "${deleteTarget?.description}"?`}
        confirmLabel="Excluir" danger
      />

      {/* Invoice preview modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePreview} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-blue-500 flex-shrink-0" />
                <span className="font-semibold text-gray-900 truncate">{previewInvoice.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <a
                  href={previewInvoice.url}
                  download={previewInvoice.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={14} /> Baixar
                </a>
                <button onClick={closePreview} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-1 min-h-0">
              {previewInvoice.mime?.includes('pdf') && (
                <iframe
                  src={previewInvoice.url}
                  className="w-full rounded-lg"
                  style={{ height: 'calc(90vh - 80px)' }}
                  title={previewInvoice.name}
                />
              )}
              {previewInvoice.mime?.includes('image') && (
                <div className="flex items-center justify-center h-full p-4">
                  <img
                    src={previewInvoice.url}
                    alt={previewInvoice.name}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
