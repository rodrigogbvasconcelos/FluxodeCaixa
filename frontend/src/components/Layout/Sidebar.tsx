import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, ArrowUpDown, PieChart, Calculator,
  FileText, Upload, Users, ChevronLeft, ChevronRight,
  HardHat, LogOut, BookUser, Wallet, X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'operator', 'viewer'] },
  { path: '/projects', label: 'Projetos', icon: FolderOpen, roles: ['admin', 'manager', 'operator', 'viewer'] },
  { path: '/transactions', label: 'Lançamentos', icon: ArrowUpDown, roles: ['admin', 'manager', 'operator'] },
  { path: '/budgets', label: 'Orçamentos', icon: Calculator, roles: ['admin', 'manager'] },
  { path: '/reports', label: 'Relatórios', icon: FileText, roles: ['admin', 'manager', 'operator', 'viewer'] },
  { path: '/invoice-import', label: 'Importar NF', icon: Upload, roles: ['admin', 'manager', 'operator'] },
  { path: '/users', label: 'Usuários', icon: Users, roles: ['admin'] },
  { path: '/categories', label: 'Categorias', icon: PieChart, roles: ['admin', 'manager'] },
  { path: '/contacts', label: 'Contatos', icon: BookUser, roles: ['admin', 'manager', 'operator'] },
  { path: '/payables', label: 'Contas a Pagar/Receber', icon: Wallet, roles: ['admin', 'manager', 'operator'] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();

  const visibleItems = navItems.filter(item => hasRole(...item.roles));

  return (
    <div className={clsx(
      'flex flex-col bg-slate-900 text-white transition-all duration-300',
      // Mobile: fixed overlay drawer; Desktop: relative sidebar
      'fixed lg:relative inset-y-0 left-0 z-30',
      'min-h-screen',
      // Width: always w-64 on mobile; collapsible on desktop
      'w-64',
      collapsed && 'lg:w-16',
      // Mobile show/hide via translate; desktop always visible
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 p-4 border-b border-slate-700',
        collapsed ? 'lg:justify-center' : '',
      )}>
        <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <HardHat size={20} className="text-white" />
        </div>
        <div className={clsx('flex-1', collapsed && 'lg:hidden')}>
          <div className="font-bold text-sm leading-tight">FluxoCaixa</div>
          <div className="text-xs text-slate-400">Gestão de Obras</div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            title={collapsed ? label : undefined}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg mb-0.5 transition-colors text-sm',
              collapsed ? 'lg:justify-center lg:px-0 lg:mx-0 lg:rounded-none' : '',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} className="flex-shrink-0" />
            <span className={clsx(collapsed && 'lg:hidden')}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-slate-700 p-3">
        <div className={clsx('flex items-center gap-2 px-2 py-2 mb-2', collapsed && 'lg:hidden')}>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-medium truncate">{user?.name}</div>
            <div className="text-xs text-slate-400 truncate capitalize">{user?.role}</div>
          </div>
        </div>
        <div className={clsx('flex gap-1', collapsed ? 'lg:flex-col lg:items-center' : '')}>
          <button
            onClick={() => { logout(); onClose(); }}
            title="Sair"
            className="flex items-center gap-2 px-2 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-xs w-full"
          >
            <LogOut size={15} />
            <span className={clsx(collapsed && 'lg:hidden')}>Sair</span>
          </button>
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center gap-2 px-2 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs ml-auto flex-shrink-0"
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
