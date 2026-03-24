import React, { useEffect, useState, useRef } from 'react';
import {
  Download, Upload, Database, HardDrive, FolderOpen,
  AlertTriangle, CheckCircle, RefreshCw, Shield, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const fmtCount = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

interface DbInfo {
  db_size: number;
  uploads_size: number;
  table_counts: Record<string, number>;
}

const TABLE_LABELS: Record<string, string> = {
  users: 'Usuários',
  projects: 'Projetos',
  transactions: 'Lançamentos',
  categories: 'Categorias',
  budgets: 'Orçamentos',
  invoices: 'Notas Fiscais',
  contacts: 'Contatos',
  audit_logs: 'Logs de Auditoria',
};

export default function Backup() {
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInfo = () => {
    setLoadingInfo(true);
    api.get('/backup/info')
      .then(r => setInfo(r.data))
      .catch(() => toast.error('Erro ao carregar informações do banco de dados'))
      .finally(() => setLoadingInfo(false));
  };

  useEffect(() => { loadInfo(); }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/backup/download', { responseType: 'blob' });
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `fluxocaixa-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setRestoring(true);
    setConfirmRestore(false);
    try {
      const fd = new FormData();
      fd.append('backup', selectedFile);
      const res = await api.post('/backup/restore', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRestoreDone(true);
      toast.success(res.data.message || 'Restauração concluída');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao restaurar backup');
      setRestoring(false);
    }
  };

  if (restoreDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={36} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Restauração concluída!</h2>
        <p className="text-gray-500 text-sm text-center max-w-sm mb-6">
          O servidor está reiniciando. Aguarde alguns segundos e recarregue a página para acessar os dados restaurados.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary"
        >
          <RefreshCw size={16} /> Recarregar página
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Backup e Restauração</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie cópias de segurança do banco de dados</p>
      </div>

      {/* Admin-only notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Esta área é exclusiva para administradores. O backup inclui todos os dados do sistema
          (lançamentos, projetos, usuários, contatos) e os arquivos de notas fiscais anexados.
        </p>
      </div>

      {/* DB Info */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Database size={18} className="text-blue-600" /> Banco de Dados Atual
          </h2>
          <button onClick={loadInfo} disabled={loadingInfo}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw size={15} className={loadingInfo ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingInfo ? (
          <div className="flex items-center justify-center h-24 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : info ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <Database size={20} className="text-slate-500 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Banco de dados</div>
                  <div className="font-semibold text-sm text-gray-900">{fmtBytes(info.db_size)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <FolderOpen size={20} className="text-slate-500 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Anexos (NFs)</div>
                  <div className="font-semibold text-sm text-gray-900">{fmtBytes(info.uploads_size)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(info.table_counts).map(([table, count]) => (
                <div key={table} className="p-2.5 border border-gray-100 rounded-lg">
                  <div className="text-xs text-gray-500 truncate">{TABLE_LABELS[table] || table}</div>
                  <div className="font-semibold text-gray-900 text-sm">{fmtCount(count)}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Backup Download */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
          <Download size={18} className="text-emerald-600" /> Gerar Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Cria um arquivo <strong>.zip</strong> compactado contendo o banco de dados completo e todos os
          arquivos de notas fiscais. Salve-o em local seguro.
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-success"
        >
          {downloading
            ? <><RefreshCw size={15} className="animate-spin" /> Gerando...</>
            : <><Download size={15} /> Baixar Backup (.zip)</>}
        </button>
      </div>

      {/* Restore */}
      <div className="card border-orange-100">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
          <Upload size={18} className="text-orange-500" /> Restaurar Backup
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Selecione um arquivo de backup gerado por este sistema para restaurar os dados.
          <strong className="text-orange-600"> Todos os dados atuais serão substituídos.</strong>
        </p>

        {/* File picker */}
        <div className="mb-4">
          {selectedFile ? (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <HardDrive size={18} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-orange-800 truncate">{selectedFile.name}</div>
                <div className="text-xs text-orange-600">{fmtBytes(selectedFile.size)}</div>
              </div>
              <button
                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-orange-400 hover:text-orange-600 text-xs underline flex-shrink-0"
              >
                Trocar
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 cursor-pointer p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors">
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">Clique para selecionar o arquivo .zip de backup</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 space-y-1">
            <p><strong>Atenção:</strong> Esta operação é irreversível.</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Todos os dados atuais serão <strong>substituídos</strong> pelos dados do backup</li>
              <li>O servidor irá <strong>reiniciar automaticamente</strong> após a restauração</li>
              <li>Recomenda-se gerar um backup do estado atual antes de restaurar</li>
            </ul>
          </div>
        </div>

        {!confirmRestore ? (
          <button
            onClick={() => setConfirmRestore(true)}
            disabled={!selectedFile || restoring}
            className="btn-danger"
          >
            <Upload size={15} /> Restaurar Backup
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">Confirmar restauração?</p>
              <p className="text-xs text-red-600 mt-0.5">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setConfirmRestore(false)} className="btn-secondary text-sm py-1.5 px-3">
                Cancelar
              </button>
              <button onClick={handleRestore} disabled={restoring} className="btn-danger text-sm py-1.5 px-3">
                {restoring
                  ? <><RefreshCw size={13} className="animate-spin" /> Restaurando...</>
                  : 'Sim, restaurar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help info */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
        <Info size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>O que está incluído no backup?</strong></p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Banco de dados SQLite completo (todos os registros)</li>
            <li>Arquivos de notas fiscais e comprovantes anexados</li>
            <li>Metadados do backup (data, versão, contagens)</li>
          </ul>
          <p className="mt-2"><strong>Recomendação:</strong> Realize backups periodicamente e antes de qualquer atualização do sistema.</p>
        </div>
      </div>
    </div>
  );
}
