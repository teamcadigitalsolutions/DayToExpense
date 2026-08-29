import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Receipt, Users, Target, ShieldCheck, RefreshCw, FileSpreadsheet,
  Plus, Search, Download, Trash2, CheckCircle, Calculator, ChevronRight, Upload, X, AlertTriangle, Sparkles, TrendingUp, Edit2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';
import { settingsService } from '../../services';

export default function SmartHubPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';
  const { formatAmount } = useCurrency();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'receipts' | 'splitter' | 'debt' | 'runway' | 'subscriptions' | 'tax'>('receipts');

  // ---------------------------------------------------------------------------
  // TAB 1: RECEIPTS & WARRANTY LOCKER STATE
  // ---------------------------------------------------------------------------
  const [receipts, setReceipts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`smart_receipts_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [receiptForm, setReceiptForm] = useState({
    title: '', store: '', date: new Date().toISOString().split('T')[0],
    amount: '', category: 'Tax Deductible Business Expense', warranty_until: '', notes: '', file_name: '',
  });

  // ---------------------------------------------------------------------------
  // TAB 2: GROUP EXPENSE SPLITTER STATE
  // ---------------------------------------------------------------------------
  const [groups, setGroups] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`smart_groups_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupNameForm, setGroupNameForm] = useState('');
  const [groupMembersForm, setGroupMembersForm] = useState('You, Rahul, Priya');
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  const [isExpenseSplitModalOpen, setIsExpenseSplitModalOpen] = useState(false);
  const [splitForm, setSplitForm] = useState({ payer: 'You', title: '', amount: '' });

  // ---------------------------------------------------------------------------
  // TAB 3: DEBT PAYOFF PLANNER STATE
  // ---------------------------------------------------------------------------
  const [debts, setDebts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`smart_debts_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtForm, setDebtForm] = useState({ name: '', balance: '', rate: '', min_payment: '' });
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraPayment, setExtraPayment] = useState<number>(2000);

  // ---------------------------------------------------------------------------
  // TAB 4: EMERGENCY RESERVE & RUNWAY STATE
  // ---------------------------------------------------------------------------
  const [liquidSavings, setLiquidSavings] = useState<number>(0);
  const [monthlyEssentialExpense, setMonthlyEssentialExpense] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // TAB 5: SUBSCRIPTION AUDIT STATE
  // ---------------------------------------------------------------------------
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`smart_subscriptions_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    name: '', cost: '', billing: 'Monthly', next_date: new Date().toISOString().split('T')[0], is_trial: false,
  });

  // ---------------------------------------------------------------------------
  // TAB 6: CA-READY TAX SHEET STATE
  // ---------------------------------------------------------------------------
  const DEFAULT_TAX_DATA = {
    financial_year: '2026-2027',
    taxable_income: 0,
    sec_80c_investments: 0,
    sec_80d_health: 0,
    business_expenses: 0,
    gst_paid: 0,
  };

  const [taxData, setTaxData] = useState(() => {
    try {
      const saved = localStorage.getItem(`smart_tax_${wsId}`);
      return saved ? JSON.parse(saved) : DEFAULT_TAX_DATA;
    } catch { return DEFAULT_TAX_DATA; }
  });

  // ---------------------------------------------------------------------------
  // CONSOLIDATED DB LOADER — on mount, load all hub state from DB
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wsId) return;
    settingsService.get(wsId, `smart_receipts_${wsId}`).then((d) => { if (d?.data) setReceipts(d.data); });
    settingsService.get(wsId, `smart_groups_${wsId}`).then((d) => { if (d?.data) setGroups(d.data); });
    settingsService.get(wsId, `smart_debts_${wsId}`).then((d) => { if (d?.data) setDebts(d.data); });
    settingsService.get(wsId, `smart_subscriptions_${wsId}`).then((d) => { if (d?.data) setSubscriptionsList(d.data); });
    settingsService.get(wsId, `smart_tax_${wsId}`).then((d) => { if (d && typeof d === 'object' && d.financial_year) setTaxData(d); });
    settingsService.get(wsId, `runway_${wsId}`).then((d) => {
      if (d) {
        if (d.savings !== undefined) setLiquidSavings(Number(d.savings));
        if (d.expenses !== undefined) setMonthlyEssentialExpense(Number(d.expenses));
      }
    });
  }, [wsId]);

  // ---------------------------------------------------------------------------
  // CONSOLIDATED DB SAVERS — save each piece of state to DB when it changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`smart_receipts_${wsId}`, JSON.stringify(receipts));
      settingsService.save(wsId, `smart_receipts_${wsId}`, { data: receipts });
    }
  }, [receipts, wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`smart_groups_${wsId}`, JSON.stringify(groups));
      settingsService.save(wsId, `smart_groups_${wsId}`, { data: groups });
    }
  }, [groups, wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`smart_debts_${wsId}`, JSON.stringify(debts));
      settingsService.save(wsId, `smart_debts_${wsId}`, { data: debts });
    }
  }, [debts, wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`smart_subscriptions_${wsId}`, JSON.stringify(subscriptionsList));
      settingsService.save(wsId, `smart_subscriptions_${wsId}`, { data: subscriptionsList });
    }
  }, [subscriptionsList, wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`smart_tax_${wsId}`, JSON.stringify(taxData));
      settingsService.save(wsId, `smart_tax_${wsId}`, taxData);
    }
  }, [taxData, wsId]);

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`runway_savings_${wsId}`, String(liquidSavings));
      localStorage.setItem(`runway_expenses_${wsId}`, String(monthlyEssentialExpense));
      settingsService.save(wsId, `runway_${wsId}`, { savings: liquidSavings, expenses: monthlyEssentialExpense });
    }
  }, [liquidSavings, monthlyEssentialExpense, wsId]);

  // ---------------------------------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------------------------------
  const activeGroup = groups[activeGroupIndex] || { id: '', name: 'No Active Group', members: [], expenses: [] };
  const totalGroupExpense = (activeGroup.expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const perPersonShare = activeGroup.members.length > 0 ? totalGroupExpense / activeGroup.members.length : 0;

  const memberBalances: Record<string, number> = {};
  (activeGroup.members || []).forEach((m: string) => { memberBalances[m] = -perPersonShare; });
  (activeGroup.expenses || []).forEach((e: any) => {
    memberBalances[e.payer] = (memberBalances[e.payer] || 0) + Number(e.amount);
  });

  const handleDeleteGroupExpense = (expId: string) => {
    setGroups((prev) =>
      prev.map((g, idx) =>
        idx === activeGroupIndex
          ? { ...g, expenses: g.expenses.filter((e: any) => e.id !== expId) }
          : g
      )
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm('Delete this entire bill splitting group?')) {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setActiveGroupIndex(0);
    }
  };

  const totalDebtBalance = debts.reduce((sum, d) => sum + Number(d.balance || 0), 0);

  const handleDeleteDebt = (id: string) => {
    if (confirm('Remove this loan / debt account?')) {
      setDebts((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleDeleteReceipt = (id: string) => {
    if (confirm('Delete this stored receipt record?')) {
      setReceipts((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const runwayMonths = monthlyEssentialExpense > 0 ? (liquidSavings / monthlyEssentialExpense).toFixed(1) : '0';

  const monthlySubTotal = subscriptionsList.reduce((sum, s) => {
    return sum + (s.billing === 'Yearly' ? Number(s.cost) / 12 : Number(s.cost));
  }, 0);

  const handleDeleteSub = (id: string) => {
    if (confirm('Delete this subscription entry?')) {
      setSubscriptionsList((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-blue-600" size={24} /> Smart Financial Utilities & Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            All-in-one customizable financial toolkit for receipt lockers, bill splitting, debt payoffs, runway calculation, and CA tax packages
          </p>
        </div>
      </div>

      {/* RESPONSIVE TAB CONTROL */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'receipts' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Receipt size={15} /> Receipt Locker ({receipts.length})
          </button>

          <button
            onClick={() => setActiveTab('splitter')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'splitter' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={15} /> Group Bill Splitter ({groups.length})
          </button>

          <button
            onClick={() => setActiveTab('debt')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'debt' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Target size={15} /> Debt Payoff Planner ({debts.length})
          </button>

          <button
            onClick={() => setActiveTab('runway')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'runway' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShieldCheck size={15} /> Emergency Runway ({runwayMonths} Mo)
          </button>

          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'subscriptions' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <RefreshCw size={15} /> Subscription Audit ({subscriptionsList.length})
          </button>

          <button
            onClick={() => setActiveTab('tax')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'tax' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet size={15} /> CA Tax & GST Package
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RECEIPT & WARRANTY LOCKER */}
      {/* ========================================================================= */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Stored Invoices & Warranty Documents</h3>
            <button
              onClick={() => {
                setEditingReceiptId(null);
                setReceiptForm({
                  title: '', store: '', date: new Date().toISOString().split('T')[0],
                  amount: '', category: 'Tax Deductible Business Expense', warranty_until: '', notes: '', file_name: '',
                });
                setIsReceiptModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Add Receipt / Bill
            </button>
          </div>

          {receipts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Receipt size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-gray-700 mb-1">No Stored Receipts Found</p>
              <p className="text-xs text-gray-400 mb-4">Click "Add Receipt / Bill" above to store your invoice documents and warranty cards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receipts.map((rec) => (
                <div key={rec.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{rec.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Store / Merchant: {rec.store || 'General Store'}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                      {rec.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Purchase Date</span>
                      <span className="font-mono text-gray-800 font-medium">{rec.date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Warranty Valid Until</span>
                      <span className="font-mono text-green-600 font-semibold">{rec.warranty_until || 'N/A'}</span>
                    </div>
                  </div>

                  {rec.notes && <p className="text-xs text-gray-600 leading-relaxed">📝 {rec.notes}</p>}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                    <span className="font-bold text-gray-900">{formatAmount(rec.amount)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingReceiptId(rec.id);
                          setReceiptForm({
                            title: rec.title,
                            store: rec.store || '',
                            date: rec.date,
                            amount: String(rec.amount),
                            category: rec.category,
                            warranty_until: rec.warranty_until || '',
                            notes: rec.notes || '',
                            file_name: rec.file_name || '',
                          });
                          setIsReceiptModalOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteReceipt(rec.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GROUP EXPENSE SPLITTER */}
      {/* ========================================================================= */}
      {activeTab === 'splitter' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Group Trip & Event Expense Splitter</h3>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Create New Group
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Users size={36} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-gray-700 mb-1">No Group Expense Splitters Found</p>
              <p className="text-xs text-gray-400 mb-4">Click "Create New Group" above to start splitting bills for trips, house rent, or events.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
              {/* Group Selector Dropdown */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-500">Active Group:</label>
                  <select
                    value={activeGroupIndex}
                    onChange={(e) => setActiveGroupIndex(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {groups.map((g, idx) => (
                      <option key={g.id} value={idx}>{g.name} ({g.members?.length || 0} members)</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsExpenseSplitModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    + Add Group Bill
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(activeGroup.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-lg"
                  >
                    Delete Group
                  </button>
                </div>
              </div>

              {/* Per-Person Share Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(memberBalances).map(([member, bal]) => (
                  <div key={member} className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-center">
                    <p className="text-xs text-gray-500 font-medium">{member}</p>
                    <p className={`text-sm font-bold mt-1 ${bal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {bal >= 0 ? `Gets back ${formatAmount(bal)}` : `Owes ${formatAmount(Math.abs(bal))}`}
                    </p>
                  </div>
                ))}
              </div>

              {/* List of Group Expenses */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-700">Group Expense Log ({activeGroup.expenses?.length || 0})</h4>
                {(!activeGroup.expenses || activeGroup.expenses.length === 0) ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">No bills added to this group yet. Click "+ Add Group Bill".</p>
                ) : (
                  activeGroup.expenses.map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-xs">
                      <div>
                        <span className="font-bold text-gray-900">{exp.title}</span>
                        <span className="text-gray-500 block text-[10px]">Paid by <strong className="text-gray-800">{exp.payer}</strong></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 text-sm">{formatAmount(exp.amount)}</span>
                        <button onClick={() => handleDeleteGroupExpense(exp.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEBT PAYOFF PLANNER */}
      {/* ========================================================================= */}
      {activeTab === 'debt' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Debt Freedom Simulator</h3>
            <button
              onClick={() => {
                setDebtForm({ name: '', balance: '', rate: '', min_payment: '' });
                setIsDebtModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Add Debt Account
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <p className="text-xs text-gray-500">Total Outstanding Dues: <strong className="text-red-600">{formatAmount(totalDebtBalance)}</strong></p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStrategy('avalanche')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    strategy === 'avalanche' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  ⚡ Debt Avalanche (Highest Interest First)
                </button>
                <button
                  onClick={() => setStrategy('snowball')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    strategy === 'snowball' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  ❄️ Debt Snowball (Lowest Balance First)
                </button>
              </div>
            </div>

            {/* Extra Monthly Payment Slider */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <label className="block text-xs font-semibold text-purple-900 mb-1">
                Extra Monthly Payment Towards Principal: {formatAmount(extraPayment)}
              </label>
              <input
                type="range"
                min="500"
                max="10000"
                step="500"
                value={extraPayment}
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {/* Debts Table */}
            {debts.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No active loan or credit card debts recorded. Click "Add Debt Account" above.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <th className="text-left p-3 font-semibold">Loan / Credit Account</th>
                    <th className="text-right p-3 font-semibold">Outstanding Balance</th>
                    <th className="text-right p-3 font-semibold">Interest Rate</th>
                    <th className="text-right p-3 font-semibold">Min Monthly Payment</th>
                    <th className="p-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {debts.map((d) => (
                    <tr key={d.id}>
                      <td className="p-3 font-bold text-gray-900">{d.name}</td>
                      <td className="p-3 text-right font-bold text-red-600">{formatAmount(d.balance)}</td>
                      <td className="p-3 text-right font-semibold text-purple-700">{d.rate}% / yr</td>
                      <td className="p-3 text-right font-medium text-gray-700">{formatAmount(d.min_payment)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDeleteDebt(d.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EMERGENCY RESERVE & RUNWAY */}
      {/* ========================================================================= */}
      {activeTab === 'runway' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Financial Runway & Safety Reserve</h3>
                <p className="text-xs text-gray-500">Calculate how long your savings can cover living costs if income stops</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-blue-600">{runwayMonths}</span>
                <span className="text-xs font-semibold text-gray-500 block">Months Runway</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Liquid Bank & Cash Savings (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={liquidSavings || ''}
                  onChange={(e) => setLiquidSavings(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Average Monthly Living Expenses (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 35000"
                  value={monthlyEssentialExpense || ''}
                  onChange={(e) => setMonthlyEssentialExpense(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Health Meter Box */}
            <div className={`p-4 rounded-xl border ${Number(runwayMonths) >= 6 ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck size={18} />
                <span>
                  {Number(runwayMonths) >= 6 ? 'Excellent Financial Protection (6+ Months Secured)' : 'Financial Runway Health Gauge'}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed">
                With your current savings of {formatAmount(liquidSavings)}, you can sustain living expenses for{' '}
                <strong>{runwayMonths} months</strong> without active income.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SUBSCRIPTION AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Recurring Subscriptions Audit</h3>
            <button
              onClick={() => {
                setSubForm({ name: '', cost: '', billing: 'Monthly', next_date: new Date().toISOString().split('T')[0], is_trial: false });
                setIsSubModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus size={14} /> Add Subscription
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <p className="text-xs text-gray-500">Total Monthly Outflow: <strong className="text-purple-600">{formatAmount(monthlySubTotal)}</strong></p>
            </div>

            {subscriptionsList.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No active recurring subscriptions logged. Click "Add Subscription" above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subscriptionsList.map((sub) => (
                  <div key={sub.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 text-sm">{sub.name}</h4>
                        {sub.is_trial && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Trial Expiring Soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Next Renewal: <span className="font-mono text-gray-700">{sub.next_date}</span></p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold text-gray-900 text-sm">{formatAmount(sub.cost)}</span>
                        <span className="text-[10px] text-gray-500 block">/{sub.billing.toLowerCase()}</span>
                      </div>
                      <button onClick={() => handleDeleteSub(sub.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CA TAX & GST PACKAGE */}
      {/* ========================================================================= */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-gray-900 text-base">CA-Ready Tax & GST Summary ({taxData.financial_year})</h3>
                <p className="text-xs text-gray-500">Summary sheet for Section 80C deductions, business expenses, and GST filing</p>
              </div>
              <button
                onClick={() => alert('Downloading CA Tax Package (CSV / PDF)...')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Download size={14} /> Download CA Report
              </button>
            </div>

            {/* Editable Tax Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gross Taxable Income (₹)</label>
                <input
                  type="number"
                  value={taxData.taxable_income || ''}
                  onChange={(e) => setTaxData((t: any) => ({ ...t, taxable_income: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Sec 80C Investments (LIC / ELSS / PPF) (₹)</label>
                <input
                  type="number"
                  value={taxData.sec_80c_investments || ''}
                  onChange={(e) => setTaxData((t: any) => ({ ...t, sec_80c_investments: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Business Expense Deductions (₹)</label>
                <input
                  type="number"
                  value={taxData.business_expenses || ''}
                  onChange={(e) => setTaxData((t: any) => ({ ...t, business_expenses: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">GST Input Tax Credit Paid (₹)</label>
                <input
                  type="number"
                  value={taxData.gst_paid || ''}
                  onChange={(e) => setTaxData((t: any) => ({ ...t, gst_paid: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="text-xs text-blue-700 font-medium">Sec 80C Deductions</span>
                <p className="text-xl font-bold text-blue-900 mt-1">{formatAmount(taxData.sec_80c_investments)}</p>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <span className="text-xs text-purple-700 font-medium">Business Expenses</span>
                <p className="text-xl font-bold text-purple-900 mt-1">{formatAmount(taxData.business_expenses)}</p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-xs text-emerald-700 font-medium">Total GST Paid</span>
                <p className="text-xl font-bold text-emerald-900 mt-1">{formatAmount(taxData.gst_paid)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Receipt Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingReceiptId ? 'Edit Receipt Record' : 'Upload Receipt / Bill Document'}</h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingReceiptId) {
                  setReceipts((prev) =>
                    prev.map((r) =>
                      r.id === editingReceiptId
                        ? { ...r, title: receiptForm.title, store: receiptForm.store, date: receiptForm.date, amount: parseFloat(receiptForm.amount || '0'), category: receiptForm.category, warranty_until: receiptForm.warranty_until, notes: receiptForm.notes }
                        : r
                    )
                  );
                } else {
                  const newR = {
                    id: 'rec-' + Date.now(),
                    title: receiptForm.title,
                    store: receiptForm.store,
                    date: receiptForm.date,
                    amount: parseFloat(receiptForm.amount || '0'),
                    category: receiptForm.category,
                    warranty_until: receiptForm.warranty_until,
                    notes: receiptForm.notes,
                    file_name: 'uploaded_bill.pdf',
                  };
                  setReceipts((prev) => [newR, ...prev]);
                }
                setIsReceiptModalOpen(false);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Item / Receipt Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony TV Invoice / Laptop Bill"
                  value={receiptForm.title}
                  onChange={(e) => setReceiptForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Store / Merchant</label>
                  <input
                    type="text"
                    placeholder="e.g. Croma / Amazon"
                    value={receiptForm.store}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, store: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={receiptForm.amount}
                    onChange={(e) => setReceiptForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Valid Until (Optional)</label>
                <input
                  type="date"
                  value={receiptForm.warranty_until}
                  onChange={(e) => setReceiptForm((f) => ({ ...f, warranty_until: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Serial Number</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Serial No: SN-99482..."
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  {editingReceiptId ? 'Update Receipt' : 'Save Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Create Bill Splitting Group</h3>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const memList = groupMembersForm.split(',').map((m) => m.trim()).filter(Boolean);
                const newG = {
                  id: 'grp-' + Date.now(),
                  name: groupNameForm,
                  members: memList.length > 0 ? memList : ['You'],
                  expenses: [],
                };
                setGroups((prev) => [...prev, newG]);
                setActiveGroupIndex(groups.length);
                setIsGroupModalOpen(false);
                setGroupNameForm('');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Group / Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Goa Trip 2026 / Flat Rent"
                  value={groupNameForm}
                  onChange={(e) => setGroupNameForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Group Members (Comma Separated)</label>
                <input
                  type="text"
                  required
                  placeholder="You, Rahul, Priya, Amit"
                  value={groupMembersForm}
                  onChange={(e) => setGroupMembersForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Group Bill Modal */}
      {isExpenseSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Group Expense</h3>
              <button onClick={() => setIsExpenseSplitModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newE = {
                  id: 'exp-' + Date.now(),
                  payer: splitForm.payer,
                  title: splitForm.title,
                  amount: parseFloat(splitForm.amount || '0'),
                };
                setGroups((prev) =>
                  prev.map((g, idx) =>
                    idx === activeGroupIndex
                      ? { ...g, expenses: [newE, ...(g.expenses || [])] }
                      : g
                  )
                );
                setIsExpenseSplitModalOpen(false);
                setSplitForm({ payer: 'You', title: '', amount: '' });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinner & Drinks"
                  value={splitForm.title}
                  onChange={(e) => setSplitForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Paid By</label>
                  <select
                    value={splitForm.payer}
                    onChange={(e) => setSplitForm((f) => ({ ...f, payer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {(activeGroup.members || ['You']).map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="3000"
                    value={splitForm.amount}
                    onChange={(e) => setSplitForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseSplitModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Add Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Debt Account Modal */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Loan / Debt Account</h3>
              <button onClick={() => setIsDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newD = {
                  id: 'd-' + Date.now(),
                  name: debtForm.name,
                  balance: parseFloat(debtForm.balance || '0'),
                  rate: parseFloat(debtForm.rate || '0'),
                  min_payment: parseFloat(debtForm.min_payment || '0'),
                };
                setDebts((prev) => [...prev, newD]);
                setIsDebtModalOpen(false);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Loan / Card Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Credit Card"
                  value={debtForm.name}
                  onChange={(e) => setDebtForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Balance (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="45000"
                    value={debtForm.balance}
                    onChange={(e) => setDebtForm((f) => ({ ...f, balance: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Interest %</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="18.5"
                    value={debtForm.rate}
                    onChange={(e) => setDebtForm((f) => ({ ...f, rate: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Min Pay (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="2500"
                    value={debtForm.min_payment}
                    onChange={(e) => setDebtForm((f) => ({ ...f, min_payment: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Add Debt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subscription Modal */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Recurring Subscription</h3>
              <button onClick={() => setIsSubModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newS = {
                  id: 'sub-' + Date.now(),
                  name: subForm.name,
                  cost: parseFloat(subForm.cost || '0'),
                  billing: subForm.billing,
                  next_date: subForm.next_date,
                  is_trial: subForm.is_trial,
                };
                setSubscriptionsList((prev) => [...prev, newS]);
                setIsSubModalOpen(false);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Service / App Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix Premium / Gym Membership"
                  value={subForm.name}
                  onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cost (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="649"
                    value={subForm.cost}
                    onChange={(e) => setSubForm((f) => ({ ...f, cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select
                    value={subForm.billing}
                    onChange={(e) => setSubForm((f) => ({ ...f, billing: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Next Renewal Date</label>
                <input
                  type="date"
                  required
                  value={subForm.next_date}
                  onChange={(e) => setSubForm((f) => ({ ...f, next_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trial_chk"
                  checked={subForm.is_trial}
                  onChange={(e) => setSubForm((f) => ({ ...f, is_trial: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="trial_chk" className="text-xs font-medium text-gray-700">
                  This is a Free Trial expiring soon
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  Add Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
