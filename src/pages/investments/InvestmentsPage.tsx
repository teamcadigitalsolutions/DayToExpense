import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Plus, X, PieChart as PieIcon, Calculator, ArrowUpRight,
  ShieldCheck, RefreshCw, DollarSign, Edit2, Trash2, Sparkles, Building2
} from 'lucide-react';
import { investmentService, settingsService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

const INVESTMENT_TYPES: Record<string, string> = {
  MUTUAL_FUND: 'Mutual Fund',
  SIP: 'SIP',
  FIXED_DEPOSIT: 'Fixed Deposit',
  STOCKS: 'Stocks',
  INSURANCE: 'Insurance',
  RECURRING_DEPOSIT: 'RD',
  GOLD: 'Digital Gold',
  REAL_ESTATE: 'Real Estate',
  OTHER: 'Other',
};

export default function InvestmentsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'calculator'>('portfolio');

  // Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdateValueModalOpen, setIsUpdateValueModalOpen] = useState(false);
  const [updatingInvId, setUpdatingInvId] = useState<string | null>(null);
  const [updatedValueInput, setUpdatedValueInput] = useState('');

  const [form, setForm] = useState({
    name: '',
    type: 'MUTUAL_FUND',
    institution: '',
    invested_amount: '',
    current_value: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // ---------------------------------------------------------------------------
  // INTERACTIVE FINANCIAL CALCULATOR STATE (SIP & FD WEALTH PROJECTIONS)
  // ---------------------------------------------------------------------------
  const [calcType, setCalcType] = useState<'SIP' | 'FD'>('SIP');
  const [sipMonthly, setSipMonthly] = useState('10000');
  const [sipReturnRate, setSipReturnRate] = useState('12'); // 12% annual return
  const [sipTenureYears, setSipTenureYears] = useState('10'); // 10 years

  const [fdPrincipal, setFdPrincipal] = useState('100000');
  const [fdRate, setFdRate] = useState('7.5'); // 7.5% per annum
  const [fdTenureYears, setFdTenureYears] = useState('5');

  // SIP Compound Math
  const monthlyRate = parseFloat(sipReturnRate || '12') / 12 / 100;
  const totalMonths = parseInt(sipTenureYears || '10', 10) * 12;
  const pSip = parseFloat(sipMonthly || '10000');
  
  const totalSipInvested = pSip * totalMonths;
  const projectedSipCorpus = Math.round(
    pSip * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate)
  );
  const estimatedSipWealthGain = projectedSipCorpus - totalSipInvested;

  // FD Compound Math
  const pFd = parseFloat(fdPrincipal || '100000');
  const rFd = parseFloat(fdRate || '7.5') / 100;
  const tFd = parseFloat(fdTenureYears || '5');
  const projectedFdMaturity = Math.round(pFd * Math.pow(1 + rFd / 4, 4 * tFd)); // Quarterly compounding
  const fdInterestEarned = projectedFdMaturity - pFd;

  // ---------------------------------------------------------------------------
  // BACKEND QUERY & LOCAL STORAGE FALLBACK SYNC
  // ---------------------------------------------------------------------------
  const { data: backendInvestments = [], isLoading } = useQuery({
    queryKey: ['investments', wsId],
    queryFn: () => investmentService.list(wsId),
    enabled: !!wsId,
  });

  const { data: backendPortfolio } = useQuery({
    queryKey: ['portfolio', wsId],
    queryFn: () => investmentService.getPortfolio(wsId),
    enabled: !!wsId,
  });

  // DB-backed custom investments
  const [localInvestments, setLocalInvestments] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`custom_investments_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `custom_investments_${wsId}`).then((d) => {
        if (d?.data && Array.isArray(d.data)) setLocalInvestments(d.data);
      });
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`custom_investments_${wsId}`, JSON.stringify(localInvestments));
      settingsService.save(wsId, `custom_investments_${wsId}`, { data: localInvestments });
    }
  }, [localInvestments, wsId]);

  // Combined Portfolio Items
  const allInvestments = backendInvestments;

  // Combined Summary Metrics
  const totalInvestedSum = allInvestments.reduce((sum: number, inv: any) => sum + Number(inv.invested_amount || 0), 0);
  const totalCurrentValueSum = allInvestments.reduce((sum: number, inv: any) => sum + Number(inv.current_value || inv.invested_amount || 0), 0);
  const totalPnLSum = totalCurrentValueSum - totalInvestedSum;
  const totalReturnPct = totalInvestedSum > 0 ? (totalPnLSum / totalInvestedSum) * 100 : 0;

  const createMutation = useMutation({
    mutationFn: (newInv: any) => investmentService.create(wsId, newInv),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments', wsId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', wsId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      setIsOpen(false);
      setForm({
        name: '',
        type: 'MUTUAL_FUND',
        institution: '',
        invested_amount: '',
        current_value: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => investmentService.update(wsId, data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments', wsId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', wsId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      setIsUpdateValueModalOpen(false);
      setUpdatingInvId(null);
      setUpdatedValueInput('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => investmentService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments', wsId] });
      queryClient.invalidateQueries({ queryKey: ['portfolio', wsId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.invested_amount) return;

    createMutation.mutate({
      ...form,
      invested_amount: parseFloat(form.invested_amount),
      current_value: form.current_value ? parseFloat(form.current_value) : parseFloat(form.invested_amount),
    });
  };

  const handleUpdateCurrentValueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVal = parseFloat(updatedValueInput || '0');
    if (!updatingInvId || newVal <= 0) return;

    updateMutation.mutate({
      id: updatingInvId,
      payload: { current_value: newVal },
    });
  };

  const handleDeleteInvestment = (id: string) => {
    if (confirm('Delete this investment entry?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={24} /> Investment Portfolio & Wealth Projections
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track mutual funds, SIPs, fixed deposits, stocks, digital gold & simulate wealth compounding
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white border border-gray-200 rounded-lg p-1 flex items-center gap-1 shadow-sm">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'portfolio' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <PieIcon size={14} className="inline mr-1" /> Portfolio ({allInvestments.length})
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'calculator' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calculator size={14} className="inline mr-1" /> Wealth Simulator
            </button>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus size={16} /> Add Investment
          </button>
        </div>
      </div>

      {/* KPI Portfolio Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Invested Capital</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatAmount(backendPortfolio ? backendPortfolio.total_invested : totalInvestedSum)}
          </p>
          <span className="text-[11px] text-gray-400 block mt-0.5">Across All Assets</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Current Market Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatAmount(backendPortfolio ? backendPortfolio.current_value : totalCurrentValueSum)}
          </p>
          <span className="text-[11px] text-green-700 font-medium block mt-0.5">Live Valuation</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Profit & Loss (P&L)</p>
          <p className={`text-2xl font-bold mt-1 ${totalPnLSum >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatAmount(backendPortfolio ? backendPortfolio.total_profit_loss : totalPnLSum)}
          </p>
          <span className="text-[11px] text-gray-400 block mt-0.5">Unrealized Gain/Loss</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Overall Return %</p>
          <p className={`text-2xl font-bold mt-1 ${totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(backendPortfolio ? Number(backendPortfolio.total_return_pct) : totalReturnPct).toFixed(2)}%
          </p>
          <span className="text-[11px] text-gray-400 block mt-0.5">Absolute Portfolio Yield</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PORTFOLIO HOLDINGS & ASSET CARDS */}
      {/* ========================================================================= */}
      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Active Investment Holdings</h2>
            <span className="text-xs text-gray-500 font-mono">{allInvestments.length} Total Assets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)
            ) : allInvestments.length === 0 ? (
              <div className="col-span-full bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
                <PieIcon size={36} className="mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-gray-700 mb-1">No Investments Found</p>
                <p className="text-xs text-gray-400 mb-4">Click "Add Investment" above to start tracking your mutual funds, SIPs, or fixed deposits.</p>
              </div>
            ) : (
              allInvestments.map((inv: any) => {
                const pnl = Number(inv.profit_loss ?? (inv.current_value - inv.invested_amount));
                const ret = Number(inv.return_pct ?? (inv.invested_amount > 0 ? (pnl / inv.invested_amount) * 100 : 0));

                return (
                  <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-100">
                          {INVESTMENT_TYPES[inv.type] ?? inv.type}
                        </span>
                        {pnl >= 0 ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
                      </div>

                      <h3 className="font-bold text-gray-900 text-base">{inv.name}</h3>
                      {inv.institution && <p className="text-xs text-gray-500">{inv.institution}</p>}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-[10px] text-gray-400 block">Invested</span>
                          <span className="font-bold text-gray-900">{formatAmount(inv.invested_amount)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block">Current Value</span>
                          <span className="font-bold text-gray-900">{inv.current_value ? formatAmount(inv.current_value) : '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block">P&L Gain/Loss</span>
                          <span className={`font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pnl >= 0 ? '+' : ''}{formatAmount(pnl)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block">Return Rate</span>
                          <span className={`font-bold ${ret >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setUpdatingInvId(inv.id);
                          setUpdatedValueInput(String(inv.current_value || inv.invested_amount));
                          setIsUpdateValueModalOpen(true);
                        }}
                        className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Update Value
                      </button>
                      <button onClick={() => handleDeleteInvestment(inv.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Delete Investment">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERACTIVE WEALTH COMPOUNDING SIMULATOR (SIP & FD) */}
      {/* ========================================================================= */}
      {activeTab === 'calculator' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Sparkles className="text-purple-600" size={20} /> SIP & FD Wealth Compounding Simulator
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Simulate future compounding wealth corpus for monthly SIPs or lump-sum Fixed Deposits
              </p>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setCalcType('SIP')}
                className={`px-3 py-1 text-xs font-bold rounded-md ${calcType === 'SIP' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
              >
                Monthly SIP
              </button>
              <button
                onClick={() => setCalcType('FD')}
                className={`px-3 py-1 text-xs font-bold rounded-md ${calcType === 'FD' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
              >
                Fixed Deposit (FD)
              </button>
            </div>
          </div>

          {calcType === 'SIP' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Monthly SIP Amount (₹)</span>
                    <span className="font-mono text-purple-700">₹{parseFloat(sipMonthly || '0').toLocaleString('en-IN')}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={sipMonthly}
                    onChange={(e) => setSipMonthly(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Expected Annual Return Rate (%)</span>
                    <span className="font-mono text-purple-700">{sipReturnRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={sipReturnRate}
                    onChange={(e) => setSipReturnRate(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Investment Tenure (Years)</span>
                    <span className="font-mono text-purple-700">{sipTenureYears} Years</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    step="1"
                    value={sipTenureYears}
                    onChange={(e) => setSipTenureYears(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>

              {/* Projections Card */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Projected Future Wealth Corpus</span>
                  <p className="text-3xl font-extrabold text-purple-900 mt-1 font-mono">
                    ₹{projectedSipCorpus.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-200 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Total Invested Principal</span>
                    <span className="font-bold text-gray-900 font-mono">₹{totalSipInvested.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-green-700 font-bold block">Estimated Compounding Gain</span>
                    <span className="font-bold text-green-700 font-mono">+₹{estimatedSipWealthGain.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FD Controls */}
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Fixed Deposit Principal (₹)</span>
                    <span className="font-mono text-purple-700">₹{parseFloat(fdPrincipal || '0').toLocaleString('en-IN')}</span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="2000000"
                    step="10000"
                    value={fdPrincipal}
                    onChange={(e) => setFdPrincipal(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Interest Rate (% per annum)</span>
                    <span className="font-mono text-purple-700">{fdRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="0.25"
                    value={fdRate}
                    onChange={(e) => setFdRate(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span>Tenure (Years)</span>
                    <span className="font-mono text-purple-700">{fdTenureYears} Years</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={fdTenureYears}
                    onChange={(e) => setFdTenureYears(e.target.value)}
                    className="w-full h-2 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                </div>
              </div>

              {/* FD Projection Card */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Maturity Payout Corpus</span>
                  <p className="text-3xl font-extrabold text-purple-900 mt-1 font-mono">
                    ₹{projectedFdMaturity.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-purple-200 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Initial Deposit</span>
                    <span className="font-bold text-gray-900 font-mono">₹{pFd.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-green-700 font-bold block">Total Interest Earned</span>
                    <span className="font-bold text-green-700 font-mono">+₹{fdInterestEarned.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Investment Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add New Investment</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Investment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parag Parikh Flexi Cap Fund"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MUTUAL_FUND">Mutual Fund</option>
                    <option value="SIP">SIP</option>
                    <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                    <option value="STOCKS">Stocks</option>
                    <option value="GOLD">Digital Gold</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Institution / Broker</label>
                  <input
                    type="text"
                    placeholder="e.g. Zerodha, Groww, SBI"
                    value={form.institution}
                    onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Invested Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50000"
                    value={form.invested_amount}
                    onChange={(e) => setForm((f) => ({ ...f, invested_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Current Value (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Leave empty if same"
                    value={form.current_value}
                    onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  required
                  value={form.purchase_date}
                  onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Price Modal */}
      {isUpdateValueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Update Current Market Value</h3>
              <button onClick={() => setIsUpdateValueModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateCurrentValueSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Current Market Value (₹)</label>
                <input
                  type="number"
                  required
                  value={updatedValueInput}
                  onChange={(e) => setUpdatedValueInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-green-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUpdateValueModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  Update Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
