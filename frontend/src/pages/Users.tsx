import React, { useEffect, useState } from 'react';
import { Plus, Edit2, UserX, Key, Shield, ShieldAlert, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { User } from '../types';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const roleInfo: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  admin: { label: 'Administrador', color: 'bg-purple-100 text-purple-700', icon: ShieldAlert, desc: 'Acesso total ao sistema' },
  manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-700', icon: Shield, desc: 'Gerencia projetos e lançamentos' },
  operator: { label: 'Operador', color: 'bg-amber-100 text-amber-700', icon: Edit2, desc: 'Cria e edita lançamentos' },
  viewer: { label: 'Visualizador', color: 'bg-gray-100 text-gray-600', icon: Eye, desc: 'Apenas visualização' },
};

const emptyForm = { name: '', email: '', password: '', role: 'operator' };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setEditingUser(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, { ...form, active: editingUser.active });
        toast.success('Usuário atualizado!');
      } else {
        if (!form.password) { toast.error('Senha obrigatória'); setSaving(false); return; }
        await api.post('/users', form);
        toast.success('Usuário criado!');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetModal || !newPassword) return;
    try {
      await api.put(`/users/${resetModal.id}/reset-password`, { newPassword });
      toast.success('Senha redefinida!');
      setResetModal(null);
      setNewPassword('');
    } catch {
      toast.error('Erro ao redefinir senha');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await api.delete(`/users/${deactivateTarget.id}`);
      toast.success('Usuário desativado');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao desativar');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Novo Usuário</button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(roleInfo).map(([key, info]) => (
          <div key={key} className="bg-white border border-gray-100 rounded-xl p-3">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-1 ${info.color}`}>
              <info.icon size={11} /> {info.label}
            </div>
            <p className="text-xs text-gray-400">{info.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">E-mail</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Perfil</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => {
                const info = roleInfo[u.role] || roleInfo.viewer;
                const isMe = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{u.name}{isMe && <span className="text-xs text-blue-500 ml-1">(você)</span>}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.color}`}>
                        <info.icon size={11} /> {info.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(u)} title="Editar"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { setResetModal(u); setNewPassword(''); }} title="Redefinir senha"
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                          <Key size={14} />
                        </button>
                        {!isMe && u.active && (
                          <button onClick={() => setDeactivateTarget(u)} title="Desativar"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <UserX size={14} />
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
      )}

      {/* User modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Editar Usuário' : 'Novo Usuário'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nome Completo *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="form-label">E-mail *</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          {!editingUser && (
            <div>
              <label className="form-label">Senha *</label>
              <input type="password" className="form-input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
          )}
          <div>
            <label className="form-label">Perfil de Acesso *</label>
            <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {Object.entries(roleInfo).map(([k, v]) => (
                <option key={k} value={k}>{v.label} — {v.desc}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title={`Redefinir senha: ${resetModal?.name}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">Nova Senha</label>
            <input type="password" className="form-input" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setResetModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleReset} disabled={!newPassword || newPassword.length < 6} className="btn-primary">Redefinir</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} onConfirm={handleDeactivate}
        title="Desativar Usuário"
        message={`Deseja desativar o usuário "${deactivateTarget?.name}"? Ele não conseguirá mais acessar o sistema.`}
        confirmLabel="Desativar" danger
      />
    </div>
  );
}
