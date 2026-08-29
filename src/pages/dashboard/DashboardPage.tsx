import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Wallet, BarChart2,
  CreditCard, Landmark, RefreshCw, Info, Sparkles,
  FolderKanban, BellRing, Target, Users, Receipt, FileText, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { dashboardService, settingsService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, usePeriod } from '../../hooks';
import { clsx } from 'clsx';

const PERIOD_OPTIONS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'LAST_MONTH', label: 'Last Month' },
  { value: 'THIS_YEAR', label: 'This Year' },
];

const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

function SummaryCard({ label, value, icon: Icon, color, subLabel, trend }: {
  label: string; value: string; icon: any; color: string; subLabel?: string; trend?: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={clsx('p-2 rounded-lg', color)}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {subLabel && <p className="text-xs text-gray-500 mt-0.5">{subLabel}</p>}
        {trend !== undefined && (
          <p className={clsx('text-xs mt-1 font-medium', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last period
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount, formatCompact } = useCurrency();
  const { period, setPeriod } = usePeriod('THIS_MONTH');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary', wsId, period],
    queryFn: () => dashboardService.getSummary(wsId, { period }),
    enabled: !!wsId,
    staleTime: 2000,
  });

  const { data: monthlyData = [] } = useQuery({
    queryKey: ['dashboard-monthly', wsId],
    queryFn: () => dashboardService.getMonthlyCashflow(wsId, 12),
    enabled: !!wsId,
    staleTime: 120000,
  });

  const { data: categoryData = [] } = useQuery({
    queryKey: ['dashboard-categories', wsId, period],
    queryFn: () => dashboardService.getCategoryBreakdown(wsId, { type: 'EXPENSE', period }),
    enabled: !!wsId,
    staleTime: 60000,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['dashboard-insights', wsId, period],
    queryFn: () => dashboardService.getAnalytics(wsId, period),
    enabled: !!wsId,
    staleTime: 120000,
  });

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth', wsId],
    queryFn: () => dashboardService.getNetWorth(wsId),
    enabled: !!wsId,
    staleTime: 2000,
  });

  // DB-backed suite preview counts
  const [projectsCount, setProjectsCount] = useState(0);
  const [remindersCount, setRemindersCount] = useState(0);
  const [bucketsCount, setBucketsCount] = useState(0);
  const [receiptsCount, setReceiptsCount] = useState(0);

  useEffect(() => {
    if (!wsId) return;
    settingsService.get(wsId, `project_studio_${wsId}`).then((d) => {
      if (d?.data && Array.isArray(d.data)) setProjectsCount(d.data.length);
    });
    settingsService.get(wsId, `important_events_${wsId}`).then((d) => {
      if (d?.data && Array.isArray(d.data)) setRemindersCount(d.data.length);
    });
    settingsService.get(wsId, `savings_buckets_${wsId}`).then((d) => {
      if (d?.data && Array.isArray(d.data)) setBucketsCount(d.data.length);
    });
    settingsService.get(wsId, `smart_receipts_${wsId}`).then((d) => {
      if (d?.data && Array.isArray(d.data)) setReceiptsCount(d.data.length);
    });
  }, [wsId]);

  if (!wsId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No workspace selected. Please create or select a workspace.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* EXISTING TOP OVERVIEW SECTION (KEPT EXACTLY AS IT IS) */}
      {/* ========================================================================= */}

      {/* Period Selector */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value as any)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap',
              period === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Balance"
          value={isLoading ? '…' : formatCompact(summary?.total_balance ?? 0)}
          icon={Wallet} color="bg-blue-600"
          subLabel="All accounts"
        />
        <SummaryCard
          label="Income"
          value={isLoading ? '…' : formatCompact(summary?.total_income ?? 0)}
          icon={TrendingUp} color="bg-green-600"
          trend={Number(summary?.income_change_pct ?? 0)}
        />
        <SummaryCard
          label="Expenses"
          value={isLoading ? '…' : formatCompact(summary?.total_expense ?? 0)}
          icon={TrendingDown} color="bg-red-600"
          trend={Number(summary?.expense_change_pct ?? 0)}
        />
        <SummaryCard
          label="Net Cash Flow"
          value={isLoading ? '…' : formatCompact(summary?.net_cash_flow ?? 0)}
          icon={BarChart2} color="bg-purple-600"
          subLabel={`Savings rate: ${Number(summary?.savings_rate ?? 0).toFixed(1)}%`}
        />
      </div>

      {/* Secondary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Investments"
          value={formatCompact(summary?.total_investments ?? 0)}
          icon={BarChart2} color="bg-teal-600"
          subLabel={`P&L: ${formatAmount(summary?.investment_profit_loss ?? 0)}`}
        />
        <SummaryCard
          label="Loan Outstanding"
          value={formatCompact(summary?.loan_outstanding ?? 0)}
          icon={Landmark} color="bg-orange-600"
        />
        <SummaryCard
          label="CC Outstanding"
          value={formatCompact(summary?.credit_card_outstanding ?? 0)}
          icon={CreditCard} color="bg-rose-600"
        />
        <SummaryCard
          label="Net Worth"
          value={netWorth ? formatCompact(netWorth.net_worth) : '…'}
          icon={TrendingUp} color="bg-indigo-600"
          subLabel={netWorth ? `Assets: ${formatCompact(netWorth.total_assets)}` : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Income vs Expense Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Income vs Expense — Last 12 Months</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => formatAmount(v)} />
                <Bar dataKey="income" name="Income" fill="#16a34a" radius={[3,3,0,0]} maxBarSize={20} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[3,3,0,0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
          )}
        </div>

        {/* Expense Category Pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Expense by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="amount"
                  nameKey="category_name"
                  cx="50%" cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                >
                  {categoryData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatAmount(v)} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) => value.length > 14 ? value.slice(0, 13) + '…' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No expense data</div>
          )}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Info size={14} className="text-blue-500" /> Financial Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((insight: any, i: number) => (
              <div key={i} className={clsx(
                'px-4 py-3 rounded-lg text-sm',
                insight.type === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                insight.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              )}>
                {insight.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW BELOW SECTION: ALL SPECIALIZED MODULES CONTROL CENTER */}
      {/* ========================================================================= */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-blue-600" size={20} /> All Modules & Quick Access Suite
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Glance at live updates and jump directly into any business or planning module
            </p>
          </div>
        </div>

        {/* Responsive Grid of All Routes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Project Milestone Billing & Studio */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <FolderKanban size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {projectsCount} Projects
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">Project Billing & WhatsApp Studio</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Quotation splits (30/20/50), client aging dues, 1-click WhatsApp reminders & net profit.
              </p>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-blue-600 hover:underline border-t border-gray-100"
            >
              <span>Open Project Studio</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. Important Dates & Reminders */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <BellRing size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {remindersCount} Reminders
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">Important Dates & Notifications</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Birthdays, TV purchase warranties, follow-ups with 3-day advance push alerts.
              </p>
            </div>
            <button
              onClick={() => navigate('/reminders')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-amber-600 hover:underline border-t border-gray-100"
            >
              <span>Open Reminders & Alerts</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 3. Cash Flow Predictor & Goal Buckets */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {bucketsCount} Goal Buckets
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">30-Day Cash Flow & Savings Goals</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Predict low-balance overdraft risks for 30 days & earmark virtual sinking funds.
              </p>
            </div>
            <button
              onClick={() => navigate('/planner')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-emerald-600 hover:underline border-t border-gray-100"
            >
              <span>Open Cash Flow Planner</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 4. Smart Financial Hub & Utilities */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Receipt size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  6-in-1 Hub
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">Smart Hub & Utilities</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Receipt locker ({receiptsCount}), Goa trip bill splitter, debt payoff & CA tax package.
              </p>
            </div>
            <button
              onClick={() => navigate('/hub')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-purple-600 hover:underline border-t border-gray-100"
            >
              <span>Open Smart Hub</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 5. HR & Payroll Directory */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-green-50 text-green-600">
                  <Users size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                  HR Payroll
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">Payroll & Employee Directory</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Employee master directory, internal loan EMI balances, and monthly salary registers.
              </p>
            </div>
            <button
              onClick={() => navigate('/payroll')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-green-600 hover:underline border-t border-gray-100"
            >
              <span>Open HR Payroll</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 6. Invoices & Billing */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <FileText size={18} />
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  Invoices
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mt-3">Invoices & Receivables</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Generate client invoices, track pending payments, and export billing registers.
              </p>
            </div>
            <button
              onClick={() => navigate('/invoices')}
              className="flex items-center justify-between w-full pt-3 text-xs font-bold text-rose-600 hover:underline border-t border-gray-100"
            >
              <span>Open Invoices</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
