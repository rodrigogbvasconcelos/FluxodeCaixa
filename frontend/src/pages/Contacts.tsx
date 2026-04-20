import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Building2, UserCheck, MapPin, Phone, Mail, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { formatCNPJ, formatCPF, formatCEP, formatPhone } from '../utils/formatters';

interface Contact {
  id: string;
  name: string;
  type: 'client' | 'supplier' | 'both';
  document_type?: 'cpf' | 'cnpj';
  document_number?: string;
  phone?: string;
  email?: string;
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  created_at: string;
}

const emptyForm = {
  name: '', type: 'supplier' as 'client' | 'supplier' | 'both',
  document_type: 'cnpj' as 'cpf' | 'cnpj', document_number: '',
  phone: '', email: '', cep: '', address: '', number: '',
  complement: '', neighborhood: '', city: '', state: '', notes: '',
};

const typeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  client: { label: 'Cliente', icon: <UserCheck size={12} />, color: 'bg-blue-100 text-blue-700' },
  supplier: { label: 'Fornecedor', icon: <Building2 size={12} />, color: 'bg-orange-100 text-orange-700' },
  both: { label: 'Cliente/Fornecedor', icon: <Users size={12} />, color: 'bg-purple-100 text-purple-700' },
};

export default function Contacts() {
  const { hasRole } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'client' | 'supplier'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: any = {};
    if (tab !== 'all') params.type = tab;
    if (search) params.search = search;
    // API returns { data, total } since pagination was added
    api.get('/contacts', { params }).then(r => setContacts(r.data.data ?? r.data)).finally(() => setLoading(false));
  }, [tab, search]);

  useEffect(load, [load]);

  const openNew = (type?: 'client' | 'supplier') => {
    setEditing(null);
    setForm({ ...emptyForm, type: type || 'supplier' });
    setModalOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type,
      document_type: c.document_type || 'cnpj',
      document_number: c.document_number || '',
      phone: c.phone || '', email: c.email || '',
      cep: c.cep || '', address: c.address || '',
      number: c.number || '', complement: c.complement || '',
      neighborhood: c.neighborhood || '', city: c.city || '',
      state: c.state || '', notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const lookupCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error('CEP não encontrado'); return; }
      setForm(f => ({
        ...f,
        address: data.logradouro || f.address,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state,
        complement: data.complemento || f.complement,
      }));
      toast.success('Endereço preenchido!');
    } catch {
      toast.error('Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const lookupCNPJ = async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) { toast.error('Digite o CNPJ completo (14 dígitos)'); return; }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { toast.error('CNPJ não encontrado na Receita Federal'); return; }
      const d = await res.json();

      // Format phone: "11 23851939" → "(11) 23851939"
      const rawPhone = (d.ddd_telefone_1 || '').replace(/\D/g, '');
      const phone = rawPhone.length >= 10
        ? formatPhone(rawPhone)
        : (d.ddd_telefone_1 || '');

      // Format CEP: "01311902" → "01311-902"
      const rawCep = (d.cep || '').replace(/\D/g, '');
      const cep = rawCep.length === 8 ? `${rawCep.slice(0, 5)}-${rawCep.slice(5)}` : (d.cep || '');

      // Build address from tipo + logradouro
      const logradouro = [d.descricao_tipo_logradouro, d.logradouro].filter(Boolean).join(' ');

      setForm(f => ({
        ...f,
        name: f.name || (d.razao_social ?? f.name),
        phone: phone || f.phone,
        cep: cep || f.cep,
        address: logradouro || f.address,
        number: d.numero || f.number,
        complement: d.complemento || f.complement,
        neighborhood: d.bairro || f.neighborhood,
        city: d.municipio || f.city,
        state: d.uf || f.state,
      }));

      // Fill name only if empty
      if (!form.name && d.razao_social) {
        setForm(f => ({ ...f, name: d.razao_social }));
      }

      toast.success('Dados da Receita Federal preenchidos!');
    } catch {
      toast.error('Erro ao consultar Receita Federal');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/contacts/${editing.id}`, form);
        toast.success('Contato atualizado!');
      } else {
        await api.post('/contacts', form);
        toast.success('Contato cadastrado!');
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
      await api.delete(`/contacts/${deleteTarget.id}`);
      toast.success('Contato excluído');
      load();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-gray-500 text-sm">Clientes e fornecedores</p>
        </div>
        {hasRole('admin', 'manager') && (
          <div className="flex gap-2">
            <button onClick={() => openNew('client')} className="btn-primary text-sm">
              <UserCheck size={15} /> Novo Cliente
            </button>
            <button onClick={() => openNew('supplier')} className="btn-secondary text-sm">
              <Building2 size={15} /> Novo Fornecedor
            </button>
          </div>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['all', 'client', 'supplier'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'all' ? 'Todos' : t === 'client' ? 'Clientes' : 'Fornecedores'}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-input pl-8 py-2 text-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cidade/UF</th>
                {hasRole('admin', 'manager') && <th className="px-4 py-3 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Carregando...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Nenhum contato encontrado</td></tr>
              ) : (
                contacts.map(c => {
                  const t = typeLabels[c.type] || typeLabels.supplier;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${t.color}`}>
                          {t.icon} {t.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {c.document_number ? (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-400 uppercase">{c.document_type}</span>
                            {c.document_number}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.phone ? <span className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> {c.phone}</span> : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.city ? <span className="flex items-center gap-1"><MapPin size={12} className="text-gray-400" />{c.city}{c.state ? `/${c.state}` : ''}</span> : '-'}
                      </td>
                      {hasRole('admin', 'manager') && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
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

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Contato' : 'Novo Contato'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Type selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {(['client', 'supplier', 'both'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {t === 'client' ? 'Cliente' : t === 'supplier' ? 'Fornecedor' : 'Ambos'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Nome / Razão Social *</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>

            {/* Document */}
            <div>
              <label className="form-label">Tipo de Documento</label>
              <select className="form-input" value={form.document_type}
                onChange={e => setForm(f => ({ ...f, document_type: e.target.value as 'cpf' | 'cnpj', document_number: '' }))}>
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
              </select>
            </div>
            <div>
              <label className="form-label">{form.document_type === 'cnpj' ? 'CNPJ' : 'CPF'}</label>
              <div className="flex gap-2">
                <input className="form-input font-mono flex-1"
                  value={form.document_number}
                  onChange={e => setForm(f => ({
                    ...f,
                    document_number: f.document_type === 'cnpj'
                      ? formatCNPJ(e.target.value)
                      : formatCPF(e.target.value)
                  }))}
                  placeholder={form.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                  maxLength={form.document_type === 'cnpj' ? 18 : 14}
                />
                {form.document_type === 'cnpj' && (
                  <button type="button"
                    onClick={() => lookupCNPJ(form.document_number)}
                    disabled={cnpjLoading || form.document_number.replace(/\D/g, '').length !== 14}
                    title="Consultar Receita Federal"
                    className="btn-secondary px-3 py-2 disabled:opacity-50 flex-shrink-0">
                    {cnpjLoading
                      ? <Loader2 size={15} className="animate-spin" />
                      : <RefreshCw size={15} />}
                  </button>
                )}
              </div>
              {form.document_type === 'cnpj' && (
                <p className="text-xs text-gray-400 mt-1">
                  Digite o CNPJ completo e clique em <RefreshCw size={10} className="inline" /> para preencher dados da Receita Federal
                </p>
              )}
            </div>

            {/* Contact */}
            <div>
              <label className="form-label">Telefone</label>
              <input className="form-input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
            <div>
              <label className="form-label">E-mail</label>
              <input type="email" className="form-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            {/* Address */}
            <div>
              <label className="form-label">CEP</label>
              <div className="flex gap-2">
                <input className="form-input flex-1"
                  value={form.cep}
                  onChange={e => setForm(f => ({ ...f, cep: formatCEP(e.target.value) }))}
                  placeholder="00000-000"
                  maxLength={9}
                />
                <button type="button"
                  onClick={() => lookupCEP(form.cep)}
                  disabled={cepLoading || form.cep.replace(/\D/g, '').length !== 8}
                  className="btn-secondary px-3 py-2 disabled:opacity-50">
                  {cepLoading ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Estado</label>
              <input className="form-input" value={form.state}
                onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                placeholder="SP" maxLength={2} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Logradouro</label>
              <input className="form-input" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Número</label>
              <input className="form-input" value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Complemento</label>
              <input className="form-input" value={form.complement}
                onChange={e => setForm(f => ({ ...f, complement: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Bairro</label>
              <input className="form-input" value={form.neighborhood}
                onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Cidade</label>
              <input className="form-input" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>

            <div className="md:col-span-2">
              <label className="form-label">Observações</label>
              <textarea className="form-input" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Excluir Contato"
        message={`Deseja excluir o contato "${deleteTarget?.name}"?`}
        confirmLabel="Excluir" danger
      />
    </div>
  );
}
