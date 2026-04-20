import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, FolderOpen,
  ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import { DashboardData } from '../types';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
const fmtFull = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { try { return format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR }); } catch { return d; } };
const fmtMonth = (m: string) => { try { return format(new Date(m + '-01'), 'MMM/yy', { locale: ptBR }); } catch { return m; } };

const StatCard = React.memo(function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="stat-card">
      <div className={`p-3 rounded-xl flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 truncate">{fmt(value)}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="skeleton h-7 w-40 mb-2" />
        <div className="skeleton h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-7 w-28" />
              <div className="skeleton h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 card h-64 skeleton" />
        <div className="card h-64 skeleton" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const balance = data.totalIncome - data.totalExpenses;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do fluxo de caixa</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Receitas" value={data.totalIncome} icon={TrendingUp} color="bg-emerald-500" />
        <StatCard label="Total Despesas" value={data.totalExpenses} icon={TrendingDown} color="bg-red-500" />
        <StatCard
          label="Saldo"
          value={balance}
          icon={DollarSign}
          color={balance >= 0 ? 'bg-blue-600' : 'bg-orange-500'}
          sub={balance >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
        />
        <StatCard label="Projetos Ativos" value={data.totalProjects} icon={FolderOpen} color="bg-purple-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly flow chart */}
        <div className="card xl:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Fluxo Mensal (últimos 12 meses)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.monthlyFlow.map(m => ({ ...m, month: fmtMonth(m.month) }))}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmtFull(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Receitas" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by category */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Despesas por Categoria</h3>
          {data.expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.expensesByCategory}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={75}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.expensesByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtFull(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top projects */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top Projetos por Despesa</h3>
          {data.topProjects.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.topProjects} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtFull(v)} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[0, 3, 3, 0]} />
                <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Nenhum projeto</div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">Últimos Lançamentos</h3>
          </div>
          <div className="space-y-2">
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento</p>
            ) : (
              data.recentTransactions.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'
                  }`}>
                    {t.type === 'income'
                      ? <ArrowUpRight size={13} className="text-emerald-600" />
                      : <ArrowDownRight size={13} className="text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{t.description}</div>
                    <div className="text-xs text-gray-400">{t.project_name} · {fmtDate(t.date)}</div>
                  </div>
                  <div className={`text-sm font-semibold flex-shrink-0 ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
