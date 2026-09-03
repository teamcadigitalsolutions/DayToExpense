import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Plus, Calendar,
  Wallet, Target, Trash2, Edit2, X, ArrowUpRight, ArrowDownRight, CheckCircle2, ChevronRight
} from 'lucide-react';
import { accountService, loanService, subscriptionService, transactionService, settingsService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

export interface SavingsBucket {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  linked_account_id?: string;
  category: string;
  color: string;
}

export default function CashFlowPlannerPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();

  const [activeTab, setActiveTab] = useState<'cashflow' | 'buckets'>('cashflow');
  const [minThreshold, setMinThreshold] = useState<number>(2000);

  // Fetch Accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  // Fetch Loans for EMI Debits
  const { data: loans = [] } = useQuery({
    queryKey: ['loans', wsId],
    queryFn: () => loanService.list(wsId),
    enabled: !!wsId,
  });

  // Fetch Subscriptions for Recurring Debits
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', wsId],
    queryFn: () => subscriptionService.list(wsId),
    enabled: !!wsId,
  });

  // Calculate Initial Liquid Balance across accounts
  const totalCurrentBalance = accounts.reduce((sum: number, a: any) => sum + Number(a.current_balance || 0), 0);

  // ---------------------------------------------------------------------------
  // 🔮 30-DAY CASH FLOW PREDICTOR LOGIC
  // ---------------------------------------------------------------------------
  const today = new Date();
  const projectionDays = 30;

  // Build daily timeline forecast
  const dailyProjections = Array.from({ length: projectionDays }).map((_, idx) => {
    const projDate = new Date();
    projDate.setDate(today.getDate() + idx + 1);
    const dateStr = projDate.toISOString().split('T')[0];

    // Scheduled debits on this date (e.g. EMIs or Subscriptions)
    let debitsOnDate = 0;
    const debitEvents: string[] = [];

    loans.forEach((loan: any) => {
      // EMI due dates
      if (loan.status === 'ACTIVE' && loan.emi_amount) {
        debitsOnDate += Number(loan.emi_amount);
        debitEvents.push(`EMI: ${loan.name}`);
      }
    });

    subscriptions.forEach((sub: any) => {
      if (sub.status === 'ACTIVE' && sub.next_billing_date === dateStr) {
        debitsOnDate += Number(sub.amount || sub.cost || 0);
        debitEvents.push(`Sub: ${sub.name}`);
      }
    });

    return {
      date: dateStr,
      displayDate: projDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      debits: debitsOnDate,
      debitEvents,
    };
  });

  // Running balance calculation over 30 days
  let runningBalance = totalCurrentBalance;
  const forecastTimeline = dailyProjections.map((p) => {
    runningBalance = runningBalance - p.debits;
    return {
      ...p,
      projectedBalance: runningBalance,
      isRisk: runningBalance < minThreshold,
    };
  });

  // Find risk warnings
  const riskDays = forecastTimeline.filter((t) => t.isRisk);
  const lowestPoint = Math.min(...forecastTimeline.map((t) => t.projectedBalance), totalCurrentBalance);

  // ---------------------------------------------------------------------------
  // 🎯 GOAL-BASED SAVINGS BUCKETS STATE & CRUD
  // ---------------------------------------------------------------------------
  // DB-backed GOAL-BASED SAVINGS BUCKETS STATE & CRUD
  const [buckets, setBuckets] = useState<SavingsBucket[]>(() => {
    try {
      const saved = localStorage.getItem(`savings_buckets_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `savings_buckets_${wsId}`).then((data) => {
        if (data && Array.isArray(data.data)) {
          setBuckets(data.data);
        }
        setIsLoaded(true);
      }).catch(() => setIsLoaded(true));
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`savings_buckets_${wsId}`, JSON.stringify(buckets));
      settingsService.save(wsId, `savings_buckets_${wsId}`, { data: buckets });
    }
  }, [buckets, wsId, isLoaded]);

  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [editingBucketId, setEditingBucketId] = useState<string | null>(null);
  const [bucketForm, setBucketForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    category: 'General Goal',
    color: '#2563eb',
  });

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositBucketId, setDepositBucketId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');

  const handleSaveBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketForm.name || !bucketForm.target_amount) return;

    if (editingBucketId) {
      setBuckets((prev) =>
        prev.map((b) =>
          b.id === editingBucketId
            ? {
                ...b,
                name: bucketForm.name,
                target_amount: parseFloat(bucketForm.target_amount),
                current_amount: parseFloat(bucketForm.current_amount || '0'),
                target_date: bucketForm.target_date,
                color: bucketForm.color,
              }
            : b
        )
      );
    } else {
      const newB: SavingsBucket = {
        id: 'bkt-' + Date.now(),
        name: bucketForm.name,
        target_amount: parseFloat(bucketForm.target_amount),
        current_amount: parseFloat(bucketForm.current_amount || '0'),
        target_date: bucketForm.target_date,
        category: bucketForm.category,
        color: bucketForm.color,
      };
      setBuckets((prev) => [newB, ...prev]);
    }

    setIsBucketModalOpen(false);
    setEditingBucketId(null);
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositBucketId || !depositAmount) return;

    setBuckets((prev) =>
      prev.map((b) =>
        b.id === depositBucketId
          ? { ...b, current_amount: b.current_amount + parseFloat(depositAmount) }
          : b
      )
    );

    setIsDepositModalOpen(false);
    setDepositBucketId(null);
    setDepositAmount('');
  };

  const handleDeleteBucket = (id: string) => {
    if (confirm('Delete this savings goal bucket?')) {
      setBuckets((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const totalSavedInBuckets = buckets.reduce((sum, b) => sum + b.current_amount, 0);
  const totalBucketTargets = buckets.reduce((sum, b) => sum + b.target_amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={24} /> Cash Flow Forecast & Savings Goals
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Predict 30-day bank balances, prevent low-balance overdrafts, and earmark goal-based sinking funds
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'buckets' && (
            <button
              onClick={() => {
                setEditingBucketId(null);
                setBucketForm({
                  name: '',
                  target_amount: '',
                  current_amount: '',
                  target_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  category: 'General Goal',
                  color: '#2563eb',
                });
                setIsBucketModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={16} /> Create Savings Bucket
            </button>
          )}
        </div>
      </div>

      {/* Tab Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm flex items-center gap-2">
        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'cashflow' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp size={16} /> 🔮 30-Day Cash Flow Predictor
        </button>

        <button
          onClick={() => setActiveTab('buckets')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'buckets' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Target size={16} /> 🎯 Goal Savings Buckets ({buckets.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 🔮 TAB 1: 30-DAY CASH FLOW PREDICTOR */}
      {/* ========================================================================= */}
      {activeTab === 'cashflow' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Current Total Bank Balance</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatAmount(totalCurrentBalance)}</p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Across {accounts.length} active accounts</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Projected Lowest Balance (30 Days)</span>
              <p className={`text-2xl font-bold mt-1 ${lowestPoint < minThreshold ? 'text-red-600' : 'text-green-600'}`}>
                {formatAmount(lowestPoint)}
              </p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Threshold: {formatAmount(minThreshold)}</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Low-Balance Risk Days</span>
              <p className={`text-2xl font-bold mt-1 ${riskDays.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {riskDays.length} Days Detected
              </p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Potential overdraft warning</span>
            </div>
          </div>

          {/* Low Balance Warning Banner */}
          {riskDays.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-900 shadow-sm">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-bold text-sm">⚠️ Low-Balance Overdraft Warning Detected!</h4>
                <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                  Your total liquid balance is projected to drop below your safety limit of{' '}
                  <strong>{formatAmount(minThreshold)}</strong> on{' '}
                  <strong className="underline">{riskDays[0].displayDate}</strong> (Projected Balance:{' '}
                  <strong>{formatAmount(riskDays[0].projectedBalance)}</strong>) due to scheduled debits (
                  {riskDays[0].debitEvents.join(', ')}).
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-900 shadow-sm">
              <ShieldCheck className="text-green-600 flex-shrink-0" size={20} />
              <div>
                <h4 className="font-bold text-sm">🛡️ Safe Cash Flow Forecast</h4>
                <p className="text-xs text-green-700 mt-0.5">
                  No overdraft risk detected over the next 30 days. All scheduled EMIs and bill debits are covered.
                </p>
              </div>
            </div>
          )}

          {/* Threshold Adjustment Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700">Minimum Risk Alert Threshold:</span>
              <input
                type="number"
                value={minThreshold}
                onChange={(e) => setMinThreshold(Number(e.target.value))}
                className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-gray-500">Alert triggers if projected balance falls below this amount.</span>
          </div>

          {/* 30-Day Forecast Timeline Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">30-Day Daily Cash Flow Forecast</h3>
              <span className="text-xs text-gray-500 font-mono">Next 30 Days</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Scheduled Debits / Events</th>
                    <th className="text-right px-4 py-3 font-semibold">Debits (₹)</th>
                    <th className="text-right px-4 py-3 font-semibold">Projected Balance</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {forecastTimeline.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50 ${
                        item.isRisk ? 'bg-red-50/60 font-semibold' : item.debits > 0 ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.displayDate}</td>
                      <td className="px-4 py-3 font-sans">
                        {item.debitEvents.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.debitEvents.map((evt, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                {evt}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">— No scheduled debits</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-semibold">
                        {item.debits > 0 ? `-${formatAmount(item.debits)}` : '₹0.00'}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${item.isRisk ? 'text-red-700' : 'text-gray-900'}`}>
                        {formatAmount(item.projectedBalance)}
                      </td>
                      <td className="px-4 py-3 text-center font-sans">
                        {item.isRisk ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
                            ⚠️ OVERDRAFT RISK
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                            Safe
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 TAB 2: GOAL-BASED SAVINGS BUCKETS (SINKING FUNDS) */}
      {/* ========================================================================= */}
      {activeTab === 'buckets' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Total Earmarked Dues</span>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatAmount(totalSavedInBuckets)}</p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Saved inside virtual buckets</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Combined Target Goals</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatAmount(totalBucketTargets)}</p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Across {buckets.length} savings targets</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-gray-500 font-medium">Overall Completion</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {totalBucketTargets > 0 ? ((totalSavedInBuckets / totalBucketTargets) * 100).toFixed(1) : '0'}%
              </p>
              <span className="text-[11px] text-gray-400 block mt-0.5">Goal progress ratio</span>
            </div>
          </div>

          {/* Buckets Grid */}
          {buckets.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
              <Target size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-gray-700 mb-1">No Virtual Savings Buckets Created</p>
              <p className="text-xs text-gray-400 mb-4">
                Click "Create Savings Bucket" above to earmark funds for Car Insurance, Laptops, or Vacations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buckets.map((bkt) => {
                const percent = Math.min(100, Math.round((bkt.current_amount / bkt.target_amount) * 100));
                const remaining = Math.max(0, bkt.target_amount - bkt.current_amount);

                return (
                  <div key={bkt.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                          {bkt.category}
                        </span>
                        <span className="text-xs font-bold font-mono text-gray-900">{percent}%</span>
                      </div>

                      <h3 className="font-bold text-gray-900 text-base">{bkt.name}</h3>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden my-3">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%`, backgroundColor: bkt.color || '#2563eb' }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Saved</span>
                          <span className="font-bold text-gray-900">{formatAmount(bkt.current_amount)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 block text-[10px]">Target</span>
                          <span className="font-bold text-blue-600">{formatAmount(bkt.target_amount)}</span>
                        </div>
                      </div>

                      {remaining > 0 && (
                        <p className="text-[11px] text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          🎯 Need <strong className="text-gray-800">{formatAmount(remaining)}</strong> more by{' '}
                          <span className="font-mono">{bkt.target_date}</span>
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setDepositBucketId(bkt.id);
                          setDepositAmount('');
                          setIsDepositModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold rounded-lg shadow-sm"
                      >
                        + Deposit Funds
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingBucketId(bkt.id);
                            setBucketForm({
                              name: bkt.name,
                              target_amount: String(bkt.target_amount),
                              current_amount: String(bkt.current_amount),
                              target_date: bkt.target_date,
                              category: bkt.category,
                              color: bkt.color || '#2563eb',
                            });
                            setIsBucketModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteBucket(bkt.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Bucket Modal */}
      {isBucketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingBucketId ? 'Edit Savings Bucket' : 'Create Virtual Savings Bucket'}</h3>
              <button onClick={() => setIsBucketModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBucket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Goal / Bucket Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Car Insurance / Laptop Purchase / Emergency Reserve"
                  value={bucketForm.name}
                  onChange={(e) => setBucketForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="60000"
                    value={bucketForm.target_amount}
                    onChange={(e) => setBucketForm((f) => ({ ...f, target_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Initial Saved (₹)</label>
                  <input
                    type="number"
                    placeholder="15000"
                    value={bucketForm.current_amount}
                    onChange={(e) => setBucketForm((f) => ({ ...f, current_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Completion Date</label>
                <input
                  type="date"
                  required
                  value={bucketForm.target_date}
                  onChange={(e) => setBucketForm((f) => ({ ...f, target_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBucketModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  {editingBucketId ? 'Update Bucket' : 'Create Bucket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Funds Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Deposit Funds to Goal</h3>
              <button onClick={() => setIsDepositModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeposit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deposit Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="5000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium"
                >
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
