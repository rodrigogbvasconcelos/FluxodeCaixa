import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { AuditLog } from '../types';

const LIMIT = 25;

function truncate(value: string | undefined, max = 80) {
  if (!value) return '-';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    table_name: '',
    record_id: '',
    start_date: '',
    end_date: '',
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(() => {
    setLoading(true);
    const params: any = { limit: LIMIT, page };
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.action) params.action = filters.action;
    if (filters.table_name) params.table_name = filters.table_name;
    if (filters.record_id) params.record_id = filters.record_id;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;

    api.get('/audit', { params })
      .then((response) => {
        setLogs(response.data.data || []);
        setTotal(response.data.total || 0);
      })
      .catch(() => toast.error('Erro ao carregar registros de auditoria'))
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => {
    api.get('/audit/actions').then((response) => setActions(response.data)).catch(() => {});
    api.get('/audit/tables').then((response) => setTables(response.data)).catch(() => {});
  }, []);

  useEffect(loadLogs, [loadLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleReset = () => {
    setFilters({ user_id: '', action: '', table_name: '', record_id: '', start_date: '', end_date: '' });
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
          <p className="text-gray-500 text-sm">Registros de alterações do sistema e atividades dos usuários</p>
        </div>
        <button onClick={loadLogs} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <form onSubmit={handleSearch} className="card p-4 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Usuário ID</label>
              <input
                className="form-input"
                value={filters.user_id}
                onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))}
                placeholder="ID do usuário"
              />
            </div>
            <div>
              <label className="form-label">Ação</label>
              <select
                className="form-input"
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="">Todos</option>
                {actions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tabela</label>
              <select
                className="form-input"
                value={filters.table_name}
                onChange={(e) => setFilters((f) => ({ ...f, table_name: e.target.value }))}
              >
                <option value="">Todas</option>
                {tables.map((table) => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Registro</label>
              <input
                className="form-input"
                value={filters.record_id}
                onChange={(e) => setFilters((f) => ({ ...f, record_id: e.target.value }))}
                placeholder="ID do registro"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="form-label">Data inicial</label>
            <input
              type="date"
              className="form-input"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Data final</label>
            <input
              type="date"
              className="form-input"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary">Buscar</button>
            <button type="button" onClick={handleReset} className="btn-secondary">Limpar</button>
          </div>
        </div>
      </form>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ação</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tabela</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Registro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 flex items-center justify-center gap-2"><RefreshCw className="animate-spin" size={18} /> Carregando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Nenhum registro encontrado</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.created_at.replace('T', ' ').slice(0, 19)}</td>
                    <td className="px-4 py-3 text-gray-700">{log.user_id}</td>
                    <td className="px-4 py-3 text-gray-700">{log.action}</td>
                    <td className="px-4 py-3 text-gray-700">{log.table_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{log.record_id || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xl">
                      <div className="text-xs text-gray-500">{truncate(log.old_value)}</div>
                      {log.new_value && <div className="text-xs text-gray-700 mt-1">→ {truncate(log.new_value)}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{total} registro(s)</span>
        <div className="inline-flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary text-xs px-3 py-1"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span>Página {page} de {pageCount}</span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="btn-secondary text-xs px-3 py-1"
          >
            Próxima <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
