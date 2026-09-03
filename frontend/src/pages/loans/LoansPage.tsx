import React, { useState, useEffect } from 'react';
import {
  Landmark, Plus, X, DollarSign, Calendar, CheckCircle2, TrendingDown, Trash2, Edit2, CreditCard, Sparkles, Building2, Clock, Check
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';
import { settingsService } from '../../services';

export interface SmartLoanItem {
  id: string;
  name: string;
  item_purchased: string;
  type: 'NO_COST_EMI' | 'PERSONAL' | 'HOME' | 'VEHICLE' | 'EDUCATION' | 'CREDIT_CARD_EMI';
  institution: string;
  total_item_cost: number;
  down_payment: number; // Advance paid upfront (e.g. ₹0 or ₹15,000)
  financed_amount: number; // Cost minus Down Payment
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  total_paid: number;
  outstanding_balance: number;
  start_date: string; // Loan Start Date (Origination)
  emi_start_date?: string; // First EMI Start Date
  status: 'ACTIVE' | 'CLOSED';
}

export default function LoansPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? 'default';
  const { formatAmount } = useCurrency();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<SmartLoanItem | null>(null);
  const [scheduleLoan, setScheduleLoan] = useState<SmartLoanItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'REGULAR_EMI' | 'PREPAYMENT'>('REGULAR_EMI');

  // Form State for Purchase on EMI & Advance Payment
  const [form, setForm] = useState({
    name: '',
    item_purchased: '',
    type: 'NO_COST_EMI' as SmartLoanItem['type'],
    institution: '',
    total_item_cost: '60000',
    down_payment: '0', // Advance Down Payment (Can be ₹0)
    interest_rate: '0', // No Cost EMI default 0%
    tenure_months: '12',
    emi_amount: '',
    start_date: new Date().toISOString().split('T')[0],
    emi_start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // DB-backed Smart Loans State
  const [loans, setLoans] = useState<SmartLoanItem[]>(() => {
    try {
      const saved = localStorage.getItem(`smart_loans_${wsId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `smart_loans_${wsId}`).then((data) => {
        if (Array.isArray(data)) {
          setLoans(data);
        }
        setIsLoaded(true);
      }).catch(() => {
        setIsLoaded(true);
      });
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`smart_loans_${wsId}`, JSON.stringify(loans));
      settingsService.save(wsId, `smart_loans_${wsId}`, loans);
    }
  }, [loans, wsId, isLoaded]);

  const totalOutstanding = loans
    .filter((l) => l.status === 'ACTIVE')
    .reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);

  const totalMonthlyEMI = loans
    .filter((l) => l.status === 'ACTIVE')
    .reduce((s, l) => s + Number(l.emi_amount || 0), 0);

  const resetForm = () => {
    setForm({
      name: '',
      item_purchased: '',
      type: 'NO_COST_EMI',
      institution: '',
      total_item_cost: '60000',
      down_payment: '0',
      interest_rate: '0',
      tenure_months: '12',
      emi_amount: '',
      start_date: new Date().toISOString().split('T')[0],
      emi_start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  const openAddLoan = () => {
    setEditingLoan(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditLoan = (loan: SmartLoanItem) => {
    setEditingLoan(loan);
    setForm({
      name: loan.name || '',
      item_purchased: loan.item_purchased || '',
      type: loan.type || 'NO_COST_EMI',
      institution: loan.institution || '',
      total_item_cost: String(loan.total_item_cost || 0),
      down_payment: String(loan.down_payment || 0),
      interest_rate: String(loan.interest_rate || 0),
      tenure_months: String(loan.tenure_months || 12),
      emi_amount: String(loan.emi_amount || ''),
      start_date: loan.start_date || new Date().toISOString().split('T')[0],
      emi_start_date: loan.emi_start_date || loan.start_date || new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const totalCost = parseFloat(form.total_item_cost || '0');
    const advanceDownPayment = parseFloat(form.down_payment || '0');
    if (!form.name || totalCost <= 0) return;

    const financed = Math.max(0, totalCost - advanceDownPayment);
    let tenure = parseInt(form.tenure_months || '12', 10);
    const specifiedEmi = form.emi_amount ? parseFloat(form.emi_amount) : 0;
    if (specifiedEmi > 0 && financed > 0) {
      const calcTenure = Math.ceil(financed / specifiedEmi);
      if (tenure <= 1 || tenure < calcTenure) {
        tenure = calcTenure;
      }
    }
    const calculatedEmi = specifiedEmi > 0 ? specifiedEmi : (financed / (tenure || 1));

    if (editingLoan) {
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id !== editingLoan.id) return l;
          const paidEmiPart = Math.max(0, l.total_paid - l.down_payment);
          const newTotalPaid = advanceDownPayment + paidEmiPart;
          const newOutstanding = Math.max(0, financed - paidEmiPart);
          return {
            ...l,
            name: form.name,
            item_purchased: form.item_purchased || form.name,
            type: form.type,
            institution: form.institution || 'Bank / Card Vendor',
            total_item_cost: totalCost,
            down_payment: advanceDownPayment,
            financed_amount: financed,
            interest_rate: parseFloat(form.interest_rate || '0'),
            tenure_months: tenure,
            emi_amount: calculatedEmi,
            total_paid: newTotalPaid,
            outstanding_balance: newOutstanding,
            start_date: form.start_date,
            emi_start_date: form.emi_start_date,
            status: newOutstanding === 0 ? 'CLOSED' : 'ACTIVE',
          };
        })
      );
    } else {
      const newLoan: SmartLoanItem = {
        id: 'loan-' + Date.now(),
        name: form.name,
        item_purchased: form.item_purchased || form.name,
        type: form.type,
        institution: form.institution || 'Bank / Card Vendor',
        total_item_cost: totalCost,
        down_payment: advanceDownPayment,
        financed_amount: financed,
        interest_rate: parseFloat(form.interest_rate || '0'),
        tenure_months: tenure,
        emi_amount: calculatedEmi,
        total_paid: advanceDownPayment,
        outstanding_balance: financed,
        start_date: form.start_date,
        emi_start_date: form.emi_start_date,
        status: 'ACTIVE',
      };
      setLoans((prev) => [newLoan, ...prev]);
    }

    setIsModalOpen(false);
    setEditingLoan(null);
    resetForm();
  };

  const generateSchedule = (loan: SmartLoanItem) => {
    const installments = [];
    const emi = loan.emi_amount || (loan.financed_amount / (loan.tenure_months || 1));
    const calcTenure = emi > 0 ? Math.ceil(loan.financed_amount / emi) : (loan.tenure_months || 12);
    const tenure = Math.max(loan.tenure_months || 1, calcTenure);

    const paidCount = Math.floor(Math.max(0, loan.total_paid - loan.down_payment) / (emi || 1));
    const annualRate = loan.interest_rate || 0;
    const monthlyRate = annualRate / 12 / 100;

    let balance = loan.financed_amount;
    const startDate = new Date(loan.emi_start_date || loan.start_date || new Date());

    for (let i = 1; i <= tenure; i++) {
      if (balance <= 0 && i > 1) break;

      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + (i - 1));

      const interestPortion = monthlyRate > 0 ? balance * monthlyRate : 0;
      const principalPortion = Math.min(balance, Math.max(0, emi - interestPortion));
      const actualEmi = principalPortion + interestPortion;
      balance = Math.max(0, balance - principalPortion);
      const isPaid = i <= paidCount || loan.status === 'CLOSED';

      installments.push({
        number: i,
        dueDate: dueDate.toISOString().split('T')[0],
        emiAmount: actualEmi,
        principal: principalPortion,
        interest: interestPortion,
        remainingBalance: balance,
        isPaid,
      });
    }

    return installments;
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount || '0');
    if (!selectedLoanId || amt <= 0) return;

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id !== selectedLoanId) return l;
        const newTotalPaid = l.total_paid + amt;
        const newOutstanding = Math.max(0, l.outstanding_balance - amt);
        return {
          ...l,
          total_paid: newTotalPaid,
          outstanding_balance: newOutstanding,
          status: newOutstanding === 0 ? 'CLOSED' : 'ACTIVE',
        };
      })
    );

    setIsPaymentModalOpen(false);
    setSelectedLoanId(null);
    setPaymentAmount('');
  };

  const handleDeleteLoan = (id: string) => {
    if (confirm('Delete this loan & EMI repayment record?')) {
      setLoans((prev) => prev.filter((l) => l.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="text-blue-600" size={24} /> Loans, EMI Repayments & Down Payment Studio
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track item purchases on EMI (Advance ₹0 or Down Payments), monthly installments, and lump-sum prepayments
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
        >
          <Plus size={16} /> Purchase Item on EMI / Add Loan
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Outstanding EMI Debt</span>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatAmount(totalOutstanding)}</p>
          <span className="text-[11px] text-gray-400 block mt-0.5">{loans.filter(l => l.status === 'ACTIVE').length} Active Loans</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Monthly EMI Obligations</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{formatAmount(totalMonthlyEMI)}</p>
          <span className="text-[11px] text-purple-700 block mt-0.5">Auto-debit from primary account</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Down Payments Paid Upfront</span>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatAmount(loans.reduce((sum, l) => sum + l.down_payment, 0))}
          </p>
          <span className="text-[11px] text-green-700 block mt-0.5">Advance Down Payments</span>
        </div>
      </div>

      {/* Loans & EMI Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loans.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 shadow-sm">
            <CreditCard size={36} className="mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-gray-700 mb-1">No Loans or EMI Purchases Logged</p>
            <p className="text-xs text-gray-400 mb-4">Click "Purchase Item on EMI / Add Loan" above to add items bought with advance down payment or 0% EMI.</p>
          </div>
        ) : (
          loans.map((loan) => {
            const progress = loan.total_item_cost > 0 ? Math.min(100, (loan.total_paid / loan.total_item_cost) * 100) : 0;
            const isClosed = loan.status === 'CLOSED';

            return (
              <div key={loan.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-base">{loan.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isClosed ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500">
                    Item: <strong className="text-gray-800">{loan.item_purchased}</strong> • Provider: <span className="font-medium text-gray-700">{loan.institution}</span>
                  </p>

                  {/* Down Payment & Financing Breakdown Box */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 my-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Total Item Price</span>
                      <span className="font-bold text-gray-900">{formatAmount(loan.total_item_cost)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-green-700 font-bold block">Advance Down Payment</span>
                      <span className="font-bold text-green-700">{formatAmount(loan.down_payment)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-gray-400 block">Financed Amount</span>
                      <span className="font-semibold text-gray-800">{formatAmount(loan.financed_amount)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-purple-700 font-bold block">Monthly EMI</span>
                      <span className="font-bold text-purple-700">{formatAmount(loan.emi_amount)} / mo</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Outstanding Balance</span>
                      <span className="font-bold text-red-600 text-sm">{formatAmount(loan.outstanding_balance)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Total Paid So Far</span>
                      <span className="font-bold text-green-600 text-sm">{formatAmount(loan.total_paid)}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between bg-gray-50/80 p-2 rounded-lg border border-gray-200/60 mb-2">
                    <span>Loan Start: <strong className="text-gray-800">{loan.start_date}</strong></span>
                    <span>1st EMI Billing: <strong className="text-purple-800">{loan.emi_start_date || loan.start_date}</strong></span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-medium text-gray-500">
                      <span>Repayment Progress</span>
                      <span>{progress.toFixed(1)}% Completed</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: progress + '%' }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                  <div className="flex items-center gap-2">
                    {!isClosed && (
                      <button
                        onClick={() => {
                          setSelectedLoanId(loan.id);
                          setPaymentAmount(String(loan.emi_amount));
                          setIsPaymentModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                      >
                        + Record EMI
                      </button>
                    )}

                    <button
                      onClick={() => setScheduleLoan(loan)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200 transition-colors"
                      title="Track Repayment Schedule"
                    >
                      <Calendar size={14} /> Schedule
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditLoan(loan)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Edit Loan Details"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteLoan(loan.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete Loan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Item on EMI / Loan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Purchase Item on EMI / Add Loan</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Loan / EMI Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LG Smart TV No-Cost EMI / HDFC Car Loan"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Item Purchased</label>
                  <input
                    type="text"
                    placeholder="e.g. Smart OLED TV / Bike"
                    value={form.item_purchased}
                    onChange={(e) => setForm((f) => ({ ...f, item_purchased: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="NO_COST_EMI">No-Cost EMI (0% Interest)</option>
                    <option value="CREDIT_CARD_EMI">Credit Card EMI</option>
                    <option value="PERSONAL">Personal Loan</option>
                    <option value="HOME">Home Loan</option>
                    <option value="VEHICLE">Vehicle Loan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Item Cost (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="80000"
                    value={form.total_item_cost}
                    onChange={(e) => setForm((f) => ({ ...f, total_item_cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-green-700 mb-1">Advance Down Payment (₹)</label>
                  <input
                    type="number"
                    placeholder="0 (Enter 0 if No Down Payment)"
                    value={form.down_payment}
                    onChange={(e) => setForm((f) => ({ ...f, down_payment: e.target.value }))}
                    className="w-full px-3 py-2 border border-green-300 bg-green-50/50 rounded-lg text-sm font-bold text-green-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tenure (Months)</label>
                  <input
                    type="number"
                    required
                    placeholder="12"
                    value={form.tenure_months}
                    onChange={(e) => {
                      const val = e.target.value;
                      const totalCost = parseFloat(form.total_item_cost || '0');
                      const down = parseFloat(form.down_payment || '0');
                      const financed = Math.max(0, totalCost - down);
                      const tenure = parseInt(val || '12', 10);
                      if (tenure > 0 && financed > 0 && !form.emi_amount) {
                        const calcEmi = Math.round(financed / tenure);
                        setForm((f) => ({ ...f, tenure_months: val, emi_amount: String(calcEmi) }));
                      } else {
                        setForm((f) => ({ ...f, tenure_months: val }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">Monthly EMI (₹)</label>
                  <input
                    type="number"
                    placeholder="Auto-calculates Tenure"
                    value={form.emi_amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const totalCost = parseFloat(form.total_item_cost || '0');
                      const down = parseFloat(form.down_payment || '0');
                      const financed = Math.max(0, totalCost - down);
                      const emi = parseFloat(val || '0');
                      if (emi > 0 && financed > 0) {
                        const calcTenure = Math.ceil(financed / emi);
                        setForm((f) => ({ ...f, emi_amount: val, tenure_months: String(calcTenure) }));
                      } else {
                        setForm((f) => ({ ...f, emi_amount: val }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-purple-300 bg-purple-50/30 rounded-lg text-sm font-bold text-purple-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank / Credit Card Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC / Bajaj"
                    value={form.institution}
                    onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={form.interest_rate}
                    onChange={(e) => setForm((f) => ({ ...f, interest_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Loan Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-700 mb-1">First EMI Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.emi_start_date}
                    onChange={(e) => setForm((f) => ({ ...f, emi_start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-purple-300 bg-purple-50/40 rounded-lg text-sm font-semibold text-purple-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  Save Loan & EMI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record EMI Payment / Prepayment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Record EMI Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-green-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Track Repayment Schedule Drawer / Modal */}
      {scheduleLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2 truncate">
                  <Calendar size={18} className="text-purple-600 shrink-0" />
                  <span className="truncate">Repayment Schedule — {scheduleLoan.name}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  Provider: {scheduleLoan.institution || 'N/A'} • Total Cost: {formatAmount(scheduleLoan.total_item_cost)}
                </p>
              </div>
              <button onClick={() => setScheduleLoan(null)} className="text-gray-400 hover:text-gray-600 p-1 shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Schedule Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 bg-purple-50/60 border border-purple-100 p-3 sm:p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-purple-700 font-medium block">Financed Amount</span>
                  <span className="text-sm font-bold text-purple-900">{formatAmount(scheduleLoan.financed_amount)}</span>
                </div>
                <div>
                  <span className="text-purple-700 font-medium block">Monthly EMI</span>
                  <span className="text-sm font-bold text-purple-900">{formatAmount(scheduleLoan.emi_amount)}</span>
                </div>
                <div>
                  <span className="text-purple-700 font-medium block">Tenure</span>
                  <span className="text-sm font-bold text-purple-900">{scheduleLoan.tenure_months} Months</span>
                </div>
              </div>

              {/* Installments Table */}
              <div className="w-full max-w-full border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">EMI Amount</th>
                      <th className="py-2.5 px-3 text-right">Principal</th>
                      <th className="py-2.5 px-3 text-right">Interest</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {generateSchedule(scheduleLoan).map((inst) => (
                      <tr key={inst.number} className={inst.isPaid ? 'bg-green-50/30 text-gray-800' : 'hover:bg-gray-50'}>
                        <td className="py-2.5 px-3 font-bold text-gray-600">Month {inst.number}</td>
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{inst.dueDate}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">{formatAmount(inst.emiAmount)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{formatAmount(inst.principal)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-500">{formatAmount(inst.interest)}</td>
                        <td className="py-2.5 px-3 text-center">
                          {inst.isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              <Check size={11} /> PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <Clock size={11} /> UPCOMING
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setScheduleLoan(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
