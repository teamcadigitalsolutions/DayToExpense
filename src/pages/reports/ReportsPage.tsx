import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Download, FileText, Calendar, Filter, Grid, Table as TableIcon,
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Printer, Search,
  FolderKanban, Users, ShieldCheck, Receipt, Landmark, Sparkles, Building2, CheckCircle2
} from 'lucide-react';
import { transactionService, accountService, categoryService, reportService, settingsService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';

const PERIOD_PRESETS = [
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'Last Month', value: 'LAST_MONTH' },
  { label: 'This Quarter', value: 'THIS_QUARTER' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'Custom Range', value: 'CUSTOM' },
];

export default function ReportsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();

  // Active Report Tab State
  const [activeTab, setActiveTab] = useState<'ledger' | 'projects' | 'payroll' | 'debt' | 'tax' | 'receipts'>('ledger');

  // Filters State
  const [period, setPeriod] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [downloading, setDownloading] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  // Fetch Accounts for Filter
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  // Fetch Categories for Filter
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId],
    queryFn: () => categoryService.list(wsId),
    enabled: !!wsId,
  });

  // Fetch Filtered Transactions for Report Data
  const { data, isLoading } = useQuery({
    queryKey: ['report-transactions', wsId, period, startDate, endDate, type, accountId, categoryId, debouncedSearch],
    queryFn: () =>
      transactionService.list(wsId, {
        start_date: period === 'CUSTOM' ? startDate || undefined : undefined,
        end_date: period === 'CUSTOM' ? endDate || undefined : undefined,
        type: type || undefined,
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        search: debouncedSearch || undefined,
        page: 1,
        size: 200,
      }),
    enabled: !!wsId,
  });

  const transactions: any[] = data?.items ?? [];

  // DB-backed Module Data for All-in-One Report Generation
  const DEFAULT_TAX = { financial_year: '2026-2027', taxable_income: 0, sec_80c_investments: 0, sec_80d_health: 0, business_expenses: 0, gst_paid: 0 };
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const [receiptsData, setReceiptsData] = useState<any[]>([]);
  const [debtsData, setDebtsData] = useState<any[]>([]);
  const [taxData, setTaxData] = useState<any>(DEFAULT_TAX);

  useEffect(() => {
    if (!wsId) return;
    settingsService.get(wsId, `project_studio_${wsId}`).then((d) => { if (d?.data) setProjectsData(d.data); });
    settingsService.get(wsId, `smart_receipts_${wsId}`).then((d) => { if (d?.data) setReceiptsData(d.data); });
    settingsService.get(wsId, `smart_debts_${wsId}`).then((d) => { if (d?.data) setDebtsData(d.data); });
    settingsService.get(wsId, `smart_tax_${wsId}`).then((d) => { if (d && d.financial_year) setTaxData(d); });
  }, [wsId]);

  // Summary Metrics
  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netCashFlow = totalIncome - totalExpense;

  const handleDownloadCSV = async (reportType: 'income' | 'expense') => {
    setDownloading(true);
    try {
      await reportService.downloadCSV(wsId, reportType, period);
    } catch {
      alert('CSV Download failed. Please ensure backend is running.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintA4PDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-Only Professional A4 Header */}
      <div className="hidden print:block mb-6 border-b-2 border-gray-900 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{currentWorkspace?.name ?? 'DayToExpense Workspace'}</h1>
            <p className="text-xs text-gray-600">Official Consolidated Financial Statement & Report</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-gray-900">Generated: {new Date().toLocaleDateString('en-IN')}</p>
            <p className="text-gray-500">Period: {period.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="text-blue-600" size={24} /> Financial Reports & A4 PDF Exporter
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            All-in-one financial statement hub for cash flow ledgers, project billing, HR payroll, tax packages & receipt inventories
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleDownloadCSV('income')}
            disabled={downloading}
            className="flex items-center gap-2 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
          >
            <Download size={14} /> Income CSV
          </button>
          <button
            onClick={() => handleDownloadCSV('expense')}
            disabled={downloading}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
          >
            <Download size={14} /> Expense CSV
          </button>
          <button
            onClick={handlePrintA4PDF}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            title="Export Clean A4 PDF / Print Report"
          >
            <Printer size={15} /> Export A4 PDF / Print
          </button>
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'ledger' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart2 size={15} /> Cash Flow Ledger ({transactions.length})
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'projects' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FolderKanban size={15} /> Project Billing Register ({projectsData.length})
          </button>

          <button
            onClick={() => setActiveTab('debt')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'debt' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Landmark size={15} /> Loans & EMI Debt ({debtsData.length})
          </button>

          <button
            onClick={() => setActiveTab('tax')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'tax' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={15} /> CA Tax & GST Package
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'receipts' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Receipt size={15} /> Receipt Inventory ({receiptsData.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL CASH FLOW LEDGER REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Filtered Total Income</p>
                <p className="text-xl font-bold text-green-600 mt-1">{formatAmount(totalIncome)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <ArrowUpRight size={20} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Filtered Total Expense</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatAmount(totalExpense)}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ArrowDownRight size={20} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Net Cash Flow</p>
                <p className={`text-xl font-bold mt-1 ${netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatAmount(netCashFlow)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign size={20} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Transactions Count</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{transactions.length} Records</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileText size={20} />
              </div>
            </div>
          </div>

          {/* Advanced Filter Control Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 print:hidden">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Filter size={16} className="text-blue-600" /> Advanced Report Filters
              </div>

              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <TableIcon size={14} /> Table View
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Grid size={14} /> Grid View
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Period Preset</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  {PERIOD_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriod('CUSTOM');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriod('CUSTOM');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="">All Types</option>
                  <option value="INCOME">Income Only</option>
                  <option value="EXPENSE">Expense Only</option>
                  <option value="TRANSFER">Transfer Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="">All Categories</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search report entries by keyword or reference..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Table View */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                    <th className="text-left px-4 py-3 font-semibold uppercase">Date</th>
                    <th className="text-left px-4 py-3 font-semibold uppercase">Description</th>
                    <th className="text-left px-4 py-3 font-semibold uppercase">Type</th>
                    <th className="text-left px-4 py-3 font-semibold uppercase">Category</th>
                    <th className="text-left px-4 py-3 font-semibold uppercase">Account</th>
                    <th className="text-right px-4 py-3 font-semibold uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono">
                        {new Date(tx.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {tx.description || tx.category_name || 'Transaction'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tx.type === 'INCOME'
                              ? 'bg-green-100 text-green-700'
                              : tx.type === 'EXPENSE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{tx.category_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{tx.account_name || '—'}</td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          tx.type === 'INCOME'
                            ? 'text-green-600'
                            : tx.type === 'EXPENSE'
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {tx.type === 'EXPENSE' ? '-' : ''}
                        {formatAmount(tx.amount)}
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
      {/* TAB 2: PROJECT MILESTONE BILLING REGISTER REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'projects' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm">Project Quotations & Client Billing Register</h3>
            <span className="text-xs font-semibold text-blue-600 font-mono">{projectsData.length} Projects Total</span>
          </div>

          {projectsData.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">No project quotations recorded yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <th className="text-left p-3 font-semibold">Project Name</th>
                  <th className="text-left p-3 font-semibold">Client Name</th>
                  <th className="text-right p-3 font-semibold">Contract Value</th>
                  <th className="text-right p-3 font-semibold">Paid Amount</th>
                  <th className="text-right p-3 font-semibold">Pending Dues</th>
                  <th className="text-center p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {projectsData.map((p: any) => {
                  const paid = p.milestones.filter((m: any) => m.status === 'PAID').reduce((sum: number, m: any) => sum + m.amount, 0);
                  const pending = p.total_cost - paid;

                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-bold text-gray-900 font-sans">{p.project_name}</td>
                      <td className="p-3 font-medium text-gray-700 font-sans">{p.client_name}</td>
                      <td className="p-3 text-right font-bold text-gray-900">{formatAmount(p.total_cost)}</td>
                      <td className="p-3 text-right font-bold text-green-600">{formatAmount(paid)}</td>
                      <td className="p-3 text-right font-bold text-amber-600">{formatAmount(pending)}</td>
                      <td className="p-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOANS & EMI DEBT REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'debt' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm">Active Loans & Credit Card Dues Statement</h3>
            <span className="text-xs font-semibold text-purple-600 font-mono">{debtsData.length} Loan Accounts</span>
          </div>

          {debtsData.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">No debt or loan accounts recorded.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <th className="text-left p-3 font-semibold">Loan Account</th>
                  <th className="text-right p-3 font-semibold">Outstanding Balance</th>
                  <th className="text-right p-3 font-semibold">Interest Rate</th>
                  <th className="text-right p-3 font-semibold">Min Monthly Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {debtsData.map((d: any) => (
                  <tr key={d.id}>
                    <td className="p-3 font-bold text-gray-900 font-sans">{d.name}</td>
                    <td className="p-3 text-right font-bold text-red-600">{formatAmount(d.balance)}</td>
                    <td className="p-3 text-right font-semibold text-purple-700">{d.rate}% / yr</td>
                    <td className="p-3 text-right font-medium text-gray-700">{formatAmount(d.min_payment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CA TAX & GST PACKAGE STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'tax' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm">CA Tax & GST Input Tax Credit Statement ({taxData.financial_year})</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-xs text-blue-700 font-medium">Sec 80C Deductions (PPF / ELSS)</span>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RECEIPT LOCKER INVENTORY STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'receipts' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm">Receipt & Warranty Document Inventory Statement</h3>
            <span className="text-xs font-semibold text-gray-500 font-mono">{receiptsData.length} Documents</span>
          </div>

          {receiptsData.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">No stored receipt invoices.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <th className="text-left p-3 font-semibold">Title</th>
                  <th className="text-left p-3 font-semibold">Store / Merchant</th>
                  <th className="text-left p-3 font-semibold">Purchase Date</th>
                  <th className="text-left p-3 font-semibold">Warranty Until</th>
                  <th className="text-right p-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {receiptsData.map((r: any) => (
                  <tr key={r.id}>
                    <td className="p-3 font-bold text-gray-900 font-sans">{r.title}</td>
                    <td className="p-3 font-medium text-gray-700 font-sans">{r.store || 'Store'}</td>
                    <td className="p-3 text-gray-600">{r.date}</td>
                    <td className="p-3 text-green-600 font-semibold">{r.warranty_until || 'N/A'}</td>
                    <td className="p-3 text-right font-bold text-gray-900">{formatAmount(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Print Signature Footer */}
      <div className="hidden print:block pt-12 mt-8 border-t border-gray-300">
        <div className="flex justify-between items-end text-xs text-gray-600">
          <div>
            <p>Prepared By: ___________________</p>
            <p className="mt-1">Date: {new Date().toLocaleDateString('en-IN')}</p>
          </div>
          <div className="text-right">
            <p>Authorized Signature: ___________________</p>
            <p className="mt-1">Company Seal / Stamp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
