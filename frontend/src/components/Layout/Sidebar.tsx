import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, ArrowUpDown, PieChart, Calculator,
  FileText, Upload, Users, ChevronLeft, ChevronRight,
  HardHat, LogOut, BookUser, Wallet, X, DatabaseBackup, ClipboardList,
  ShoppingCart, BarChart2, Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

const navGroups = [
  {
    label: 'GESTÃO',
    items: [
      { path: '/',             label: 'Dashboard',            icon: LayoutDashboard, roles: ['admin','manager','operator','viewer'] },
      { path: '/projects',     label: 'Obras',                icon: HardHat,         roles: ['admin','manager','operator','viewer'] },
      { path: '/transactions', label: 'Lançamentos',          icon: ArrowUpDown,     roles: ['admin','manager','operator'] },
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      { path: '/budgets',   label: 'Orçamentos',             icon: Calculator,  roles: ['admin','manager'] },
      { path: '/payables',  label: 'Contas a Pagar/Receber', icon: Wallet,      roles: ['admin','manager','operator'] },
      { path: '/reports',   label: 'Relatórios',             icon: BarChart2,   roles: ['admin','manager','operator','viewer'] },
    ],
  },
  {
    label: 'COMPRAS',
    items: [
      { path: '/purchases',      label: 'Pedidos de Compra', icon: ShoppingCart, roles: ['admin','manager','operator'] },
      { path: '/invoice-import', label: 'Importar NF',       icon: Upload,       roles: ['admin','manager','operator'] },
    ],
  },
  {
    label: 'CADASTROS',
    items: [
      { path: '/categories', label: 'Categorias', icon: PieChart,  roles: ['admin','manager'] },
      { path: '/contacts',   label: 'Fornecedores/Clientes', icon: BookUser, roles: ['admin','manager','operator'] },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { path: '/users',  label: 'Usuários',  icon: Users,          roles: ['admin'] },
      { path: '/audit',  label: 'Auditoria', icon: ClipboardList,  roles: ['admin'] },
      { path: '/backup', label: 'Backup',    icon: DatabaseBackup, roles: ['admin'] },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();

  return (
    <div className={clsx(
      'flex flex-col bg-slate-900 text-white transition-all duration-300',
      'fixed lg:relative inset-y-0 left-0 z-30',
      'min-h-screen',
      'w-64',
      collapsed && 'lg:w-16',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 p-4 border-b border-slate-700/60',
        collapsed ? 'lg:justify-center' : '',
      )}>
        <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <HardHat size={20} className="text-white" />
        </div>
        <div className={clsx('flex-1', collapsed && 'lg:hidden')}>
          <div className="font-bold text-sm leading-tight text-white">FluxoCaixa</div>
          <div className="text-xs text-slate-400">Gestão de Obras</div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => hasRole(...item.roles));
          if (!visibleItems.length) return null;
          return (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">
                    {group.label}
                  </span>
                </div>
              )}
              {collapsed && <div className="border-t border-slate-700/50 mx-2 my-1.5" />}
              {visibleItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg mb-0.5 transition-all text-sm',
                    collapsed ? 'lg:justify-center lg:px-0 lg:mx-1' : '',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  )}
                >
                  <Icon size={17} className="flex-shrink-0" />
                  <span className={clsx('truncate', collapsed && 'lg:hidden')}>{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-slate-700/60 p-3">
        <div className={clsx('flex items-center gap-2 px-2 py-2 mb-1', collapsed && 'lg:hidden')}>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-medium truncate">{user?.name}</div>
            <div className="text-[10px] text-slate-400 truncate capitalize">{user?.role}</div>
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
