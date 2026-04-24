import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, FolderOpen,
  ArrowUpRight, ArrowDownRight, Clock, AlertCircle, AlertTriangle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DashboardData } from '../types';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
const fmtFull = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => { try { return format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR }); } catch { return d; } };
const fmtMonth = (m: string) => { try { return format(new Date(m + '-01'), 'MMM/yy', { locale: ptBR }); } catch { return m; } };

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  cardBg?: string;
  border?: string;
  onClick?: () => void;
}

const KpiCard = React.memo(function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, cardBg, border, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 flex items-start gap-4 transition-shadow ${cardBg || 'bg-white'} ${border || 'border-gray-100'} ${onClick ? 'cursor-pointer hover:shadow-md' : 'shadow-sm'}`}
    >
      <div className={`p-3 rounded-xl flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 truncate">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-24 skeleton" />)}
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="rounded-xl border p-5 h-24 skeleton" />)}
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
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const balance = data.totalIncome - data.totalExpenses;
  const d = data as any;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral do fluxo financeiro</p>
        </div>
      </div>

      {/* Row 1 — main financial KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Receitas"
          value={fmt(data.totalIncome)}
          icon={TrendingUp}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KpiCard
          label="Total Despesas"
          value={fmt(data.totalExpenses)}
          icon={TrendingDown}
          iconBg="bg-red-100"
          iconColor="text-red-600"
        />
        <KpiCard
          label="Saldo Atual"
          value={fmt(Math.abs(balance))}
          sub={balance >= 0 ? '▲ Positivo' : '▼ Negativo'}
          icon={DollarSign}
          iconBg={balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'}
          iconColor={balance >= 0 ? 'text-blue-600' : 'text-orange-600'}
        />
        <KpiCard
          label="Obras Ativas"
          value={String(data.totalProjects)}
          sub="em andamento"
          icon={FolderOpen}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          onClick={() => navigate('/projects')}
        />
      </div>

      {/* Row 2 — pending / overdue KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/payables')}
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="p-3 rounded-xl bg-amber-100 flex-shrink-0">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-amber-900 truncate">{fmt(d.pendingExpense || 0)}</div>
            <div className="text-sm text-amber-700">A Pagar</div>
            <div className="text-xs text-amber-500">{d.pendingCount || 0} lançamentos pendentes</div>
          </div>
        </div>
        <div
          onClick={() => navigate('/payables')}
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="p-3 rounded-xl bg-emerald-100 flex-shrink-0">
            <ArrowUpRight size={20} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-emerald-900 truncate">{fmt(d.pendingIncome || 0)}</div>
            <div className="text-sm text-emerald-700">A Receber</div>
            <div className="text-xs text-emerald-500">pendente de recebimento</div>
          </div>
        </div>
        <div
          onClick={() => navigate('/payables')}
          className={`rounded-xl border p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow ${
            (d.overdueCount || 0) > 0 ? 'border-red-300 bg-red-50' : 'border-gray-100 bg-white'
          }`}
        >
          <div className={`p-3 rounded-xl flex-shrink-0 ${(d.overdueCount||0) > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
            <AlertTriangle size={20} className={(d.overdueCount||0) > 0 ? 'text-red-600' : 'text-gray-400'} />
          </div>
          <div className="min-w-0">
            <div className={`text-2xl font-bold truncate ${(d.overdueCount||0) > 0 ? 'text-red-900' : 'text-gray-400'}`}>
              {fmt(d.overdueExpense || 0)}
            </div>
            <div className={`text-sm ${(d.overdueCount||0) > 0 ? 'text-red-700' : 'text-gray-500'}`}>Vencidas</div>
            <div className={`text-xs ${(d.overdueCount||0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {d.overdueCount || 0} conta(s) em atraso
            </div>
          </div>
        </div>
        <div
          onClick={() => navigate('/purchases')}
          className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="p-3 rounded-xl bg-blue-100 flex-shrink-0">
            <AlertCircle size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-blue-900 truncate">{fmt(d.overdueIncome || 0)}</div>
            <div className="text-sm text-blue-700">A Receber Vencido</div>
            <div className="text-xs text-blue-500">receitas em atraso</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Fluxo Mensal — últimos 12 meses</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.monthlyFlow.map(m => ({ ...m, month: fmtMonth(m.month) }))}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
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
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
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
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top Obras por Despesa</h3>
          {data.topProjects.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.topProjects} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtFull(v)} />
                <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[0, 3, 3, 0]} />
                <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Nenhuma obra</div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">Últimos Lançamentos</h3>
          </div>
          <div className="space-y-1">
            {data.recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum lançamento</p>
            ) : (
              data.recentTransactions.slice(0, 8).map((t: any) => (
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
                    <div className="text-xs text-gray-400 truncate">{t.project_name} · {fmtDate(t.date)}</div>
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
