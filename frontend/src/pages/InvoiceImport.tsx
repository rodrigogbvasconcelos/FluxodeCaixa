import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Project, Category, ExtractedData } from '../types';
import { useNavigate } from 'react-router-dom';

const fmtBytes = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1048576).toFixed(1)}MB`;

export default function InvoiceImport() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploading, setUploading] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({
    project_id: '', category_id: '', type: 'expense' as 'income' | 'expense',
    amount: '', description: '', vendor: '', document_number: '',
    date: new Date().toISOString().split('T')[0], payment_method: '', notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data));
    api.get('/categories').then(r => setCategories(r.data));
  }, []);

  const handleFile = async (file: File) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
    if (!allowed.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado. Use PDF, PNG, JPG ou TXT.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setUploading(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('invoice', file);
      const { data } = await api.post('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setInvoiceId(data.id);
      setExtracted(data.extracted);

      // Auto-fill form
      const ex: ExtractedData = data.extracted;
      setForm(f => ({
        ...f,
        amount: ex.amount ? String(ex.amount) : f.amount,
        date: ex.date || f.date,
        vendor: ex.vendor || f.vendor,
        document_number: ex.documentNumber || f.document_number,
        description: ex.description || f.description,
      }));

      toast.success('Nota fiscal processada!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao processar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id || !form.category_id || !form.amount || !form.description || !form.date) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await api.post('/transactions', {
        ...form,
        amount: parseFloat(form.amount),
        invoice_id: invoiceId || undefined,
      });
      toast.success('Lançamento criado com sucesso!');
      navigate('/transactions');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar lançamento');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setInvoiceId('');
    setExtracted(null);
    setFileName('');
    setForm({
      project_id: '', category_id: '', type: 'expense',
      amount: '', description: '', vendor: '', document_number: '',
      date: new Date().toISOString().split('T')[0], payment_method: '', notes: ''
    });
  };

  const filteredCategories = categories.filter(c => c.type === form.type);
  const paymentMethods = ['Dinheiro', 'PIX', 'Transferência', 'Boleto', 'Cartão de Débito', 'Cartão de Crédito', 'Cheque'];

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar Nota Fiscal</h1>
        <p className="text-gray-500 text-sm">Faça upload da NF para extrair dados automaticamente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload area */}
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.txt"
              onChange={onFileChange} />
            {uploading ? (
              <div className="space-y-3">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500">Processando arquivo...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">Arraste ou clique para enviar</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, TXT — até 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Extraction result */}
          {extracted && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-emerald-500" />
                <span className="font-medium text-sm text-gray-800">Dados extraídos de: {fileName}</span>
                <button onClick={reset} className="ml-auto text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5 text-sm">
                {extracted.amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor:</span>
                    <span className="font-semibold text-emerald-600">
                      R$ {extracted.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {extracted.date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Data:</span>
                    <span>{extracted.date}</span>
                  </div>
                )}
                {extracted.vendor && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fornecedor:</span>
                    <span className="text-right max-w-[60%] truncate">{extracted.vendor}</span>
                  </div>
                )}
                {extracted.documentNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nº Documento:</span>
                    <span>{extracted.documentNumber}</span>
                  </div>
                )}
                {extracted.description && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 flex-shrink-0">Descrição:</span>
                    <span className="text-right text-xs text-gray-600 truncate">{extracted.description}</span>
                  </div>
                )}
              </div>

              {extracted.rawText && !extracted.amount && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs mb-1">
                    <AlertCircle size={13} />
                    <span>Preencha os campos manualmente</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => api.get(`/invoices/${invoiceId}/download`).then(() => window.open(`/api/invoices/${invoiceId}/download`))}
                className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
              >
                <Download size={12} /> Baixar arquivo original
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Dados do Lançamento</h3>

            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
                className={`flex-1 py-2 text-sm font-medium ${form.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                ↑ Receita
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
                className={`flex-1 py-2 text-sm font-medium ${form.type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                ↓ Despesa
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Projeto *</label>
                  <select className="form-input text-sm" value={form.project_id}
                    onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Categoria *</label>
                  <select className="form-input text-sm" value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
                    <option value="">Selecione...</option>
                    {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Valor (R$) *</label>
                  <input type="number" step="0.01" min="0.01" className="form-input text-sm" placeholder="0,00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label">Data *</label>
                  <input type="date" className="form-input text-sm" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className="form-label">Descrição *</label>
                <input className="form-input text-sm" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fornecedor</label>
                  <input className="form-input text-sm" value={form.vendor}
                    onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Nº Documento</label>
                  <input className="form-input text-sm" value={form.document_number}
                    onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="form-label">Forma de Pagamento</label>
                <select className="form-input text-sm" value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => navigate('/transactions')} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className={form.type === 'income' ? 'btn-success' : 'btn-danger'}>
              {saving ? 'Salvando...' : 'Criar Lançamento'} <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
