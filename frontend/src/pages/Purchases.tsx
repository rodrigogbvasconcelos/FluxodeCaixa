import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, ShoppingCart, ChevronDown, CheckCircle, XCircle, Clock, Package, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d?: string) => { if (!d) return '-'; try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; } };
const today = () => new Date().toISOString().split('T')[0];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Rascunho',  color: 'text-gray-600',   bg: 'bg-gray-100' },
  pending:   { label: 'Pendente',  color: 'text-amber-700',  bg: 'bg-amber-100' },
  approved:  { label: 'Aprovado',  color: 'text-blue-700',   bg: 'bg-blue-100' },
  received:  { label: 'Recebido',  color: 'text-emerald-700',bg: 'bg-emerald-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-700',    bg: 'bg-red-100' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:    ['pending', 'cancelled'],
  pending:  ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: [],
  cancelled:[],
};

const emptyItem = { description: '', unit: 'un', quantity: '1', unit_price: '', category_id: '', notes: '' };
const emptyForm = { project_id: '', supplier_id: '', order_date: today(), expected_date: '', notes: '', items: [{ ...emptyItem }] };

export default function Purchases() {
  const [orders, setOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProject, setFilterProject] = useState('');

  const load = useCallback(() => {
    const params: any = {};
    if (filterStatus) params.status = filterStatus;
    if (filterProject) params.project_id = filterProject;
    api.get('/purchases', { params }).then(r => setOrders(r.data)).finally(() => setLoading(false));
  }, [filterStatus, filterProject]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
    api.get('/contacts').then(r => setSuppliers(r.data.filter((c: any) => c.type === 'supplier' || c.type === 'both')));
    api.get('/categories').then(r => setCategories(r.data.filter((c: any) => c.type === 'expense')));
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, order_date: today(), items: [{ ...emptyItem }] });
    setModalOpen(true);
  };

  const openEdit = async (order: any) => {
    const res = await api.get(`/purchases/${order.id}`);
    const o = res.data;
    setEditing(o);
    setForm({
      project_id: o.project_id || '',
      supplier_id: o.supplier_id || '',
      order_date: o.order_date || today(),
      expected_date: o.expected_date || '',
      notes: o.notes || '',
      items: (o.items || []).map((i: any) => ({
        description: i.description,
        unit: i.unit || 'un',
        quantity: String(i.quantity),
        unit_price: String(i.unit_price),
        category_id: i.category_id || '',
        notes: i.notes || '',
      })),
    });
    setModalOpen(true);
  };

  const openView = async (order: any) => {
    const res = await api.get(`/purchases/${order.id}`);
    setViewOrder(res.data);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...emptyItem }] }));
  const removeItem = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx: number, field: string, value: string) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }));

  const totalAmount = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) { toast.error('Selecione uma obra'); return; }
    if (!form.items.length || !form.items[0].description) { toast.error('Adicione pelo menos um item'); return; }
    setSaving(true);
    const payload = {
      ...form,
      supplier_id: form.supplier_id || null,
      expected_date: form.expected_date || null,
      items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 1, unit_price: parseFloat(i.unit_price) || 0 })),
    };
    try {
      if (editing) {
        await api.put(`/purchases/${editing.id}`, payload);
        toast.success('Pedido atualizado!');
      } else {
        await api.post('/purchases', payload);
        toast.success('Pedido criado!');
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
      await api.delete(`/purchases/${deleteTarget.id}`);
      toast.success('Pedido excluído!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/purchases/${orderId}/status`, { status: newStatus });
      toast.success('Status atualizado!');
      load();
      if (viewOrder?.id === orderId) {
        const res = await api.get(`/purchases/${orderId}`);
        setViewOrder(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const totalOrders = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de Compra</h1>
          <p className="text-gray-500 text-sm">Gerencie solicitações de compra de materiais e serviços</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Novo Pedido
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = orders.filter(o => o.status === key).length;
          const total = orders.filter(o => o.status === key).reduce((s, o) => s + (o.total_amount || 0), 0);
          return (
            <div key={key} className={`rounded-xl border p-4 ${cfg.bg} border-opacity-50`} style={{ borderColor: 'transparent' }}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${cfg.color}`}>{cfg.label}</div>
              <div className="text-xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{fmtCurrency(total)}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <select className="form-input py-2 text-sm min-w-[160px]" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <select className="form-input py-2 text-sm min-w-[180px]" value={filterProject}
            onChange={e => setFilterProject(e.target.value)}>
            <option value="">Todas as obras</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="ml-auto text-sm text-gray-500 self-center">
            Total: <strong className="text-gray-900">{fmtCurrency(totalOrders)}</strong> em {orders.length} pedido(s)
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-16">
          <ShoppingCart size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Nenhum pedido de compra encontrado</p>
          <button onClick={openNew} className="btn-primary mx-auto"><Plus size={15} /> Criar Pedido</button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Obra</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fornecedor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Itens</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entrega</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order: any) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
                  const transitions = STATUS_TRANSITIONS[order.status] || [];
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(order.order_date)}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate font-medium">{order.project_name}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[130px] truncate">{order.supplier_name || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Package size={12} />{order.items_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(order.expected_date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCurrency(order.total_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openView(order)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver">
                            <Eye size={14} />
                          </button>
                          {order.status !== 'received' && order.status !== 'cancelled' && (
                            <button onClick={() => openEdit(order)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {transitions.length > 0 && (
                            <select
                              className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-600 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value=""
                              onChange={e => { if (e.target.value) handleStatusChange(order.id, e.target.value); }}
                            >
                              <option value="">Avançar...</option>
                              {transitions.map(s => (
                                <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>
                              ))}
                            </select>
                          )}
                          {order.status !== 'received' && (
                            <button onClick={() => setDeleteTarget(order)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Pedido' : 'Novo Pedido de Compra'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Obra *</label>
              <select className="form-input" value={form.project_id} required
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                <option value="">Selecione a obra</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Fornecedor</label>
              <select className="form-input" value={form.supplier_id}
                onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Sem fornecedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Data do Pedido *</label>
              <input type="date" className="form-input" value={form.order_date} required
                onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Previsão de Entrega</label>
              <input type="date" className="form-input" value={form.expected_date}
                onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Observações</label>
            <textarea className="form-input resize-none" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Itens *</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Adicionar item
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Descrição</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium w-16">Un.</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium w-20">Qtd.</th>
                    <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium w-28">Preço Unit.</th>
                    <th className="text-right px-2 py-2 text-xs text-gray-500 font-medium w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.items.map((item, idx) => {
                    const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                          <input className="w-full border-0 outline-none text-sm text-gray-800 bg-transparent"
                            placeholder="Descrição do item" value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-full border-0 outline-none text-sm text-gray-600 bg-transparent"
                            value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0.001" step="0.001"
                            className="w-full border-0 outline-none text-sm text-gray-800 bg-transparent"
                            value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="0.01"
                            className="w-full border-0 outline-none text-sm text-gray-800 bg-transparent"
                            placeholder="0,00" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-gray-700">
                          {fmtCurrency(lineTotal)}
                        </td>
                        <td className="px-1 py-1.5">
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1">
                              <XCircle size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-gray-700 text-right">Total:</td>
                    <td className="px-2 py-2 text-right font-bold text-gray-900">{fmtCurrency(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar Pedido'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      {viewOrder && (
        <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Pedido de Compra`} size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Obra:</span><div className="font-medium">{viewOrder.project_name}</div></div>
              <div><span className="text-gray-500">Fornecedor:</span><div className="font-medium">{viewOrder.supplier_name || '—'}</div></div>
              <div><span className="text-gray-500">Status:</span>
                <div className="mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[viewOrder.status]?.bg} ${STATUS_CONFIG[viewOrder.status]?.color}`}>
                    {STATUS_CONFIG[viewOrder.status]?.label}
                  </span>
                </div>
              </div>
              <div><span className="text-gray-500">Data:</span><div className="font-medium">{fmtDate(viewOrder.order_date)}</div></div>
              <div><span className="text-gray-500">Entrega prevista:</span><div className="font-medium">{fmtDate(viewOrder.expected_date)}</div></div>
              <div><span className="text-gray-500">Total:</span><div className="font-bold text-gray-900">{fmtCurrency(viewOrder.total_amount)}</div></div>
            </div>

            {viewOrder.notes && (
              <div className="text-sm"><span className="text-gray-500">Observações:</span><p className="mt-1 text-gray-700">{viewOrder.notes}</p></div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Descrição</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Un.</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Qtd.</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Preço Unit.</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewOrder.items || []).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{item.unit || '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmtCurrency(item.quantity * item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-700 text-right">Total:</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{fmtCurrency(viewOrder.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Status transitions */}
            {STATUS_TRANSITIONS[viewOrder.status]?.length > 0 && (
              <div className="flex gap-2 pt-1">
                <span className="text-sm text-gray-500 self-center">Avançar para:</span>
                {STATUS_TRANSITIONS[viewOrder.status].map(s => (
                  <button key={s} type="button"
                    onClick={() => handleStatusChange(viewOrder.id, s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      s === 'cancelled' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                      s === 'received'  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                      'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}>
                    {STATUS_CONFIG[s]?.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Excluir Pedido"
        message={`Excluir o pedido da obra "${deleteTarget?.project_name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir" danger
      />
    </div>
  );
}
