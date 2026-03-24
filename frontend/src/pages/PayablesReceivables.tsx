import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle, CheckCircle2, Clock, TrendingDown, TrendingUp,
  Calendar, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import { Transaction, Project } from '../types';
import Modal from '../components/UI/Modal';
import { useAuth } from '../contexts/AuthContext';
import { BrDateInput } from '../components/UI/BrInput';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtDate = (d?: string) => {
  if (!d) return '-';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
};

const today = new Date().toISOString().split('T')[0];

const paymentMethods = ['Dinheiro', 'PIX', 'Transferência', 'Boleto', 'Cartão de Débito', 'Cartão de Crédito', 'Cheque'];

interface Summary {
  count: number; total: number; overdue_total: number; overdue_count: number;
}

export default function PayablesReceivables() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [items, setItems] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<{ payables: Summary; receivables: Summary }>({
    payables:    { count: 0, total: 0, overdue_total: 0, overdue_count: 0 },
    receivables: { count: 0, total: 0, overdue_total: 0, overdue_count: 0 },
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Pay modal
  const [payTarget, setPayTarget] = useState<Transaction | null>(null);
  const [payDate, setPayDate] = useState(today);
  const [payMethod, setPayMethod] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = { type: tab };
    if (filterProject) params.project_id = filterProject;
    api.get('/payables', { params })
      .then(r => {
        setItems(r.data.data);
        setSummary(r.data.summary);
      })
      .finally(() => setLoading(false));
  }, [tab, filterProject]);

  useEffect(load, [load]);
  useEffect(() => { api.get('/projects').then(r => setProjects(r.data)); }, []);

  const openPay = (item: Transaction) => {
    setPayTarget(item);
    setPayDate(today);
    setPayMethod('');
  };

  const handlePay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await api.patch(`/transactions/${payTarget.id}/pay`, {
        payment_date: payDate,
        payment_method: payMethod || undefined,
      });
      toast.success(tab === 'expense' ? 'Pagamento registrado!' : 'Recebimento registrado!');
      setPayTarget(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar');
    } finally {
      setPaying(false);
    }
  };

  const displayed = onlyOverdue
    ? items.filter(i => i.is_overdue === 1)
    : items;

  const tabSummary = tab === 'expense' ? summary.payables : summary.receivables;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar / Receber</h1>
        <p className="text-gray-500 text-sm">Controle de vencimentos e pagamentos pendentes</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-500" />
            <span className="text-xs font-medium text-red-600">A Pagar</span>
          </div>
          <div className="text-lg font-bold text-red-700">{fmtCurrency(summary.payables.total)}</div>
          <div className="text-xs text-red-400 mt-0.5">{summary.payables.count} conta(s)</div>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-xs font-medium text-orange-600">Vencidas (pagar)</span>
          </div>
          <div className="text-lg font-bold text-orange-700">{fmtCurrency(summary.payables.overdue_total)}</div>
          <div className="text-xs text-orange-400 mt-0.5">{summary.payables.overdue_count} conta(s)</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">A Receber</span>
          </div>
          <div className="text-lg font-bold text-emerald-700">{fmtCurrency(summary.receivables.total)}</div>
          <div className="text-xs text-emerald-400 mt-0.5">{summary.receivables.count} conta(s)</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-yellow-500" />
            <span className="text-xs font-medium text-yellow-600">Vencidas (receber)</span>
          </div>
          <div className="text-lg font-bold text-yellow-700">{fmtCurrency(summary.receivables.overdue_total)}</div>
          <div className="text-xs text-yellow-400 mt-0.5">{summary.receivables.overdue_count} conta(s)</div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
          <button
            onClick={() => setTab('expense')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendingDown size={15} /> Contas a Pagar
            {summary.payables.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === 'expense' ? 'bg-red-400 text-white' : 'bg-red-100 text-red-600'
              }`}>{summary.payables.count}</span>
            )}
          </button>
          <button
            onClick={() => setTab('income')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={15} /> Contas a Receber
            {summary.receivables.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                tab === 'income' ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-600'
              }`}>{summary.receivables.count}</span>
            )}
          </button>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select className="form-input py-2 text-sm min-w-[180px]" value={filterProject}
            onChange={e => setFilterProject(e.target.value)}>
            <option value="">Todos os projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)}
              className="rounded border-gray-300" />
            Somente vencidas
          </label>
          {tabSummary.count > 0 && (
            <div className="ml-auto text-sm text-gray-500">
              Total pendente: <span className="font-semibold text-gray-800">{fmtCurrency(tabSummary.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Projeto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {tab === 'expense' ? 'Fornecedor' : 'Cliente'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                {hasRole('admin', 'manager', 'operator') && (
                  <th className="px-4 py-3 w-36"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-gray-400">
                      {onlyOverdue ? 'Nenhuma conta vencida' : `Nenhuma conta a ${tab === 'expense' ? 'pagar' : 'receber'} pendente`}
                    </p>
                  </td>
                </tr>
              ) : (
                displayed.map(item => {
                  const overdue = item.is_overdue === 1;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.due_date ? (
                          <div className={`flex items-center gap-1.5 font-medium ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
                            {overdue ? <AlertCircle size={13} /> : <Calendar size={13} className="text-gray-400" />}
                            {fmtDate(item.due_date)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sem vencimento</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[130px] truncate">{item.project_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.category_color || '#6B7280' }} />
                          {item.category_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                        <div className="truncate">{item.description}</div>
                        {(item.installments ?? 1) > 1 && (
                          <div className="text-xs text-blue-500 mt-0.5">
                            Parcela {item.installment_number}/{item.installments}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{item.vendor || '-'}</td>
                      <td className="px-4 py-3">
                        {overdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                            <AlertCircle size={10} /> Vencida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock size={10} /> Pendente
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${tab === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {fmtCurrency(item.amount)}
                      </td>
                      {hasRole('admin', 'manager', 'operator') && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openPay(item)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                              tab === 'expense'
                                ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            <CreditCard size={12} />
                            {tab === 'expense' ? 'Pagar' : 'Receber'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay/Receive Modal */}
      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={tab === 'expense' ? 'Registrar Pagamento' : 'Registrar Recebimento'}
        size="sm"
      >
        {payTarget && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg ${tab === 'expense' ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
              <div className="font-medium text-gray-800 text-sm">{payTarget.description}</div>
              <div className="text-xs text-gray-500 mt-0.5">{payTarget.project_name} · {payTarget.category_name}</div>
              {payTarget.vendor && <div className="text-xs text-gray-500">{tab === 'expense' ? 'Fornecedor' : 'Cliente'}: {payTarget.vendor}</div>}
              <div className={`text-lg font-bold mt-2 ${tab === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtCurrency(payTarget.amount)}
              </div>
              {payTarget.due_date && (
                <div className={`text-xs mt-1 ${payTarget.is_overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                  Vencimento: {fmtDate(payTarget.due_date)}
                  {payTarget.is_overdue ? ' (vencida)' : ''}
                </div>
              )}
            </div>

            <div>
              <label className="form-label">Data de {tab === 'expense' ? 'Pagamento' : 'Recebimento'} *</label>
              <BrDateInput className="form-input" value={payDate} onChange={setPayDate} />
            </div>

            <div>
              <label className="form-label">Forma de Pagamento</label>
              <select className="form-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="">Selecione...</option>
                {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setPayTarget(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={handlePay}
                disabled={paying || !payDate}
                className={tab === 'expense' ? 'btn-danger' : 'btn-success'}
              >
                {paying ? 'Registrando...' : `Confirmar ${tab === 'expense' ? 'Pagamento' : 'Recebimento'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
