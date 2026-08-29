import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, X, AlertTriangle, TrendingUp, Gauge, ShieldCheck, Flame } from 'lucide-react';
import { budgetService, categoryService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

export default function BudgetsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    period: 'MONTHLY',
    start_date: new Date().toISOString().split('T')[0],
    category_id: '',
    allocated_amount: '',
  });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', wsId],
    queryFn: () => budgetService.list(wsId),
    enabled: !!wsId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId, 'EXPENSE'],
    queryFn: () => categoryService.list(wsId, 'EXPENSE'),
    enabled: !!wsId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => budgetService.create(wsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', wsId] });
      setIsOpen(false);
      setForm({
        name: '',
        period: 'MONTHLY',
        start_date: new Date().toISOString().split('T')[0],
        category_id: '',
        allocated_amount: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.category_id || !form.allocated_amount) return;

    createMutation.mutate({
      name: form.name,
      period: form.period,
      start_date: form.start_date,
      categories: [
        {
          category_id: form.category_id,
          allocated_amount: parseFloat(form.allocated_amount),
        },
      ],
    });
  };

  // ---------------------------------------------------------------------------
  // BUDGET VELOCITY & DAILY PACING CALCULATIONS
  // ---------------------------------------------------------------------------
  const now = new Date();
  const currentDayOfMonth = now.getDate();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgressPct = Math.round((currentDayOfMonth / totalDaysInMonth) * 100);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="text-blue-600" size={24} /> Budgets & Daily Velocity Engine
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitor spending limits, daily burn rate pacing, and early budget exhaustion warnings (YNAB / Monarch style)
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Create Budget Limit
        </button>
      </div>

      {/* Month Progress Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
            <Gauge size={20} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900">
              Current Month Timeline: Day {currentDayOfMonth} of {totalDaysInMonth} ({monthProgressPct}% Elapsed)
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Ideal spending pace benchmark should be around <strong className="text-blue-600">{monthProgressPct}%</strong> of total allocated budget.
            </p>
          </div>
        </div>

        <div className="w-32 bg-gray-100 h-2.5 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${monthProgressPct}%` }} />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      ) : budgets.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
          <Target size={36} className="mx-auto mb-3 opacity-40 text-blue-500" />
          <p className="text-gray-700 font-semibold mb-1">No budgets created yet</p>
          <p className="text-xs text-gray-400 mb-4">Click "Create Budget Limit" above to start tracking budget velocity and daily pacing alerts.</p>
        </div>
      ) : (
        budgets.map((budget: any) => (
          <div key={budget.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{budget.name}</h3>
                <span className="text-xs text-gray-500">
                  Total Allocated: <strong className="text-gray-900">{formatAmount(budget.total_allocated)}</strong>
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {budget.period}
              </span>
            </div>

            {(budget.categories ?? []).map((cat: any) => {
              const allocated = Number(cat.allocated_amount || 0);
              const spent = Number(cat.spent_amount || 0);
              const pct = Math.min(100, Number(cat.percentage_used ?? 0));

              // Velocity Math
              const targetDailyPace = allocated / totalDaysInMonth;
              const currentDailyPace = spent / Math.max(1, currentDayOfMonth);
              const isOverPacing = currentDailyPace > targetDailyPace;
              const projectedRunOutDay = currentDailyPace > 0 ? Math.min(totalDaysInMonth, Math.ceil(allocated / currentDailyPace)) : totalDaysInMonth;

              return (
                <div key={cat.id || cat.category_id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{cat.category_name}</span>
                      {isOverPacing && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 flex items-center gap-1 animate-pulse">
                          <Flame size={11} /> High Velocity ({formatAmount(currentDailyPace)}/day)
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-gray-800">
                      {formatAmount(spent)} / {formatAmount(allocated)} ({pct.toFixed(0)}%)
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 100 ? 'bg-red-600' : isOverPacing ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Daily Velocity Metric Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-white border border-gray-200 rounded-lg">
                      <span className="text-[10px] text-gray-400 block font-medium">Daily Target Pace</span>
                      <span className="font-bold font-mono text-gray-800">{formatAmount(targetDailyPace)} / day</span>
                    </div>

                    <div className="p-2.5 bg-white border border-gray-200 rounded-lg">
                      <span className="text-[10px] text-gray-400 block font-medium">Actual Current Pace</span>
                      <span className={`font-bold font-mono ${isOverPacing ? 'text-red-600' : 'text-green-600'}`}>
                        {formatAmount(currentDailyPace)} / day
                      </span>
                    </div>
                  </div>

                  {/* Warning Alert Box */}
                  {isOverPacing && pct < 100 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2">
                      <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <span className="font-bold block">🚨 Budget Over-Spending Pacing Warning!</span>
                        <p className="mt-0.5 leading-relaxed text-[11px]">
                          At your current daily spending rate of <strong>{formatAmount(currentDailyPace)}/day</strong> (target pace:{' '}
                          {formatAmount(targetDailyPace)}/day), your {cat.category_name} budget will be completely exhausted on{' '}
                          <strong className="underline">Day {projectedRunOutDay}</strong> of this month!
                        </p>
                      </div>
                    </div>
                  )}

                  {!isOverPacing && (
                    <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-900 flex items-center gap-2">
                      <ShieldCheck className="text-green-600 flex-shrink-0" size={16} />
                      <span className="text-[11px] font-medium">
                        Healthy Pace: You are spending within your target daily benchmark of {formatAmount(targetDailyPace)}/day.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* Create Budget Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Create New Budget Limit</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Budget Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dining & Restaurants Budget"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Expense Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Allocated Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="10000"
                  value={form.allocated_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, allocated_amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
