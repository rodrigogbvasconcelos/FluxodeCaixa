import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Loader2, UserCheck, Building2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from './Modal';
import { formatCNPJ, formatCPF, formatPhone } from '../../utils/formatters';

interface Contact {
  id: string;
  name: string;
  type: 'client' | 'supplier' | 'both';
  document_type?: string;
  document_number?: string;
  phone?: string;
  city?: string;
  state?: string;
}

const typeLabels = {
  client: { label: 'Cliente', icon: <UserCheck size={11} />, color: 'text-blue-600 bg-blue-50' },
  supplier: { label: 'Fornecedor', icon: <Building2 size={11} />, color: 'text-orange-600 bg-orange-50' },
  both: { label: 'Cliente/Fornec.', icon: <Users size={11} />, color: 'text-purple-600 bg-purple-50' },
};

interface Props {
  value: string;
  onChange: (name: string) => void;
  /** Which types appear in the dropdown. 'client' also shows 'both'; 'supplier' also shows 'both'. */
  contactType: 'client' | 'supplier';
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ContactSearch({ value, onChange, contactType, label, required, placeholder, className }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => { setQuery(value); }, [value]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/contacts', { params: { search: query, type: contactType } });
        setResults((res.data as Contact[]).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, contactType]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (name: string) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const typeLabel = contactType === 'client' ? 'cliente' : 'fornecedor';

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {label && (
        <label className="form-label">
          {label}{required && ' *'}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="form-input pr-8"
          value={query}
          placeholder={placeholder || `Buscar ${typeLabel}...`}
          required={required}
          autoComplete="off"
          onChange={e => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {searching
          ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin pointer-events-none" />
          : <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {results.length === 0 && !searching && (
            <div className="px-3 py-2 text-xs text-gray-400">
              {query.trim() ? `Nenhum ${typeLabel} encontrado` : `Digite para buscar ${typeLabel}s`}
            </div>
          )}

          {results.map(c => {
            const t = typeLabels[c.type] ?? typeLabels.supplier;
            return (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); select(c.name); }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${t.color}`}>
                      {t.icon} {t.label}
                    </span>
                    {c.document_number && (
                      <span className="text-xs text-gray-400 font-mono">{c.document_number}</span>
                    )}
                    {c.city && (
                      <span className="text-xs text-gray-400">{c.city}{c.state ? `/${c.state}` : ''}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setCreateModal(true); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2 text-blue-600 border-t border-gray-100 transition-colors"
          >
            <Plus size={14} className="flex-shrink-0" />
            <span className="text-sm">
              {query.trim()
                ? `Cadastrar "${query}" como novo ${typeLabel}`
                : `Cadastrar novo ${typeLabel}`}
            </span>
          </button>
        </div>
      )}

      <QuickCreateContact
        open={createModal}
        initialName={query.trim()}
        defaultType={contactType}
        onClose={() => setCreateModal(false)}
        onCreated={name => {
          select(name);
          setCreateModal(false);
          toast.success(`${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} cadastrado!`);
        }}
      />
    </div>
  );
}

/* ─── Quick-create mini form ──────────────────────────── */

interface QuickCreateProps {
  open: boolean;
  initialName: string;
  defaultType: 'client' | 'supplier';
  onClose: () => void;
  onCreated: (name: string) => void;
}

const emptyQuick = {
  name: '', type: 'supplier' as 'client' | 'supplier' | 'both',
  document_type: 'cnpj' as 'cpf' | 'cnpj', document_number: '',
  phone: '', email: '', city: '', state: '',
};

function QuickCreateContact({ open, initialName, defaultType, onClose, onCreated }: QuickCreateProps) {
  const [form, setForm] = useState({ ...emptyQuick });
  const [saving, setSaving] = useState(false);

  // Reset form whenever modal opens
  useEffect(() => {
    if (open) {
      setForm({ ...emptyQuick, name: initialName, type: defaultType });
    }
  }, [open, initialName, defaultType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/contacts', form);
      onCreated(form.name);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar Contato Rápido" size="md">
      <form onSubmit={handleSave} className="space-y-3">
        {/* Type */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(['client', 'supplier', 'both'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {t === 'client' ? 'Cliente' : t === 'supplier' ? 'Fornecedor' : 'Ambos'}
            </button>
          ))}
        </div>

        <div>
          <label className="form-label">Nome / Razão Social *</label>
          <input className="form-input" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <input className="form-input font-mono"
              value={form.document_number}
              onChange={e => setForm(f => ({
                ...f,
                document_number: f.document_type === 'cnpj'
                  ? formatCNPJ(e.target.value)
                  : formatCPF(e.target.value),
              }))}
              placeholder={form.document_type === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
              maxLength={form.document_type === 'cnpj' ? 18 : 14}
            />
          </div>
          <div>
            <label className="form-label">Telefone</label>
            <input className="form-input"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
              placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          <div>
            <label className="form-label">E-mail</label>
            <input type="email" className="form-input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Cidade</label>
            <input className="form-input" value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">UF</label>
            <input className="form-input" value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="SP" maxLength={2} />
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Para preencher endereço completo e CNPJ via Receita Federal, acesse a tela de Contatos.
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
