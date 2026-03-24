import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, ArrowUpDown, PieChart, Calculator,
  FileText, Upload, Users, ChevronLeft, ChevronRight,
  HardHat, LogOut, BookUser
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
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter(item => hasRole(...item.roles));

  return (
    <div className={clsx(
      'flex flex-col bg-slate-900 text-white transition-all duration-300 min-h-screen',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 p-4 border-b border-slate-700',
        collapsed ? 'justify-center' : ''
      )}>
        <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <HardHat size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold text-sm leading-tight">FluxoCaixa</div>
            <div className="text-xs text-slate-400">Gestão de Obras</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5 transition-colors text-sm',
              collapsed ? 'justify-center px-0 mx-0 rounded-none' : '',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-slate-700 p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium truncate">{user?.name}</div>
              <div className="text-xs text-slate-400 truncate capitalize">{user?.role}</div>
            </div>
          </div>
        )}
        <div className={clsx('flex gap-1', collapsed ? 'flex-col items-center' : '')}>
          <button
            onClick={logout}
            title="Sair"
            className="flex items-center gap-2 px-2 py-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors text-xs w-full"
          >
            <LogOut size={15} />
            {!collapsed && 'Sair'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs ml-auto"
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
