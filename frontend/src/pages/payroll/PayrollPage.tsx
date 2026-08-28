import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, DollarSign, Calendar, Plus, Search, Edit2, Trash2, Landmark, CheckCircle, FileText, X, ChevronDown, UserCheck
} from 'lucide-react';
import { contactService, loanService, transactionService, accountService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = ['2026', '2025', '2024', '2023'];

export default function PayrollPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'payroll' | 'employees' | 'loans'>('payroll');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);

  // Employee Form State
  const [empForm, setEmpForm] = useState({
    id: '',
    name: '',
    designation: '',
    department: '',
    company: '',
    email: '',
    phone: '',
    base_salary: '',
    allowances: '',
    deductions: '',
  });

  // Loan Form State
  const [loanForm, setLoanForm] = useState({
    employee_name: '',
    amount: '',
    emi: '',
    notes: '',
  });

  // Fetch Employees (Contacts with type='EMPLOYEE')
  const { data: employeeContacts = [], isLoading: isEmpLoading } = useQuery({
    queryKey: ['contacts', wsId, 'EMPLOYEE', debouncedSearch],
    queryFn: () => contactService.list(wsId, { type: 'EMPLOYEE', search: debouncedSearch || undefined }),
    enabled: !!wsId,
  });

  // Fetch Accounts for Salary Disbursal
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  // Fetch Loans
  const { data: loans = [] } = useQuery({
    queryKey: ['loans', wsId],
    queryFn: () => loanService.list(wsId),
    enabled: !!wsId,
  });

  // Persisted Payroll Disbursements in LocalStorage for workspace date/year filtering
  const [disbursements, setDisbursements] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`payroll_disbursements_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (wsId) {
      localStorage.setItem(`payroll_disbursements_${wsId}`, JSON.stringify(disbursements));
    }
  }, [disbursements, wsId]);

  // Employee Save Mutation
  const saveEmployeeMutation = useMutation({
    mutationFn: (data: any) => contactService.create(wsId, { ...data, type: 'EMPLOYEE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', wsId] });
      setIsEmployeeModalOpen(false);
      setEmpForm({
        id: '',
        name: '',
        designation: '',
        department: '',
        company: '',
        email: '',
        phone: '',
        base_salary: '',
        allowances: '',
        deductions: '',
      });
    },
  });

  // Employee Loan Save Mutation
  const saveLoanMutation = useMutation({
    mutationFn: (data: any) =>
      loanService.create(wsId, {
        name: `Employee Loan - ${data.employee_name}`,
        type: 'EMPLOYEE',
        institution: 'Internal HR',
        principal: parseFloat(data.amount),
        emi_amount: parseFloat(data.emi || String(parseFloat(data.amount) / 10)),
        interest_rate: 0,
        tenure_months: 10,
        start_date: new Date().toISOString().split('T')[0],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', wsId] });
      setIsLoanModalOpen(false);
      setLoanForm({ employee_name: '', amount: '', emi: '', notes: '' });
    },
  });

  // Filtered Payroll Data for Selected Month & Year
  const filteredDisbursements = disbursements.filter(
    (d) => d.year === selectedYear && d.month.toLowerCase() === selectedMonth.toLowerCase()
  );

  const totalMonthlyPayroll = filteredDisbursements.reduce((sum, d) => sum + Number(d.net_salary || 0), 0);

  const totalEmployeeLoans = loans
    .filter((l: any) => l.type === 'EMPLOYEE' || l.institution === 'Internal HR')
    .reduce((sum: number, l: any) => sum + Number(l.outstanding_balance || 0), 0);

  const handleDisburseAll = (accountId: string) => {
    if (!accountId) return;
    const newEntries = employeeContacts.map((emp: any) => {
      const base = 50000;
      const net = base + 3000 - 1500;
      return {
        id: 'pay-' + Date.now() + '-' + Math.random().toString().slice(2, 6),
        employee_name: emp.name,
        designation: emp.company || 'Team Member',
        department: 'General',
        year: selectedYear,
        month: selectedMonth,
        disbursed_date: new Date().toISOString().split('T')[0],
        base_salary: base,
        allowance: 3000,
        deductions: 1500,
        net_salary: net,
        status: 'PAID',
      };
    });

    setDisbursements((prev) => [...prev, ...newEntries]);
    setIsDisburseModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">HR, Employee & Payroll Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage employee salaries, monthly payslips, loans, and date/month/year-wise disbursements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEmployeeModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus size={15} /> Add Employee
          </button>
          <button
            onClick={() => setIsLoanModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Landmark size={15} /> Grant Employee Loan
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Payroll ({selectedMonth} {selectedYear})</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatAmount(totalMonthlyPayroll)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            ₹
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Total Active Employees</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{employeeContacts.length} Active</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Employee Loans Outstanding</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{formatAmount(totalEmployeeLoans)}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Landmark size={22} />
          </div>
        </div>
      </div>

      {/* Tabs & Period Selectors */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'payroll' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Salary & Payslips
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'employees' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Employee Directory ({employeeContacts.length})
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'loans' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Employee Loans
          </button>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'payroll' && (
            <button
              onClick={() => setIsDisburseModalOpen(true)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Disburse {selectedMonth} Payroll
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Salary & Payslips */}
      {activeTab === 'payroll' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">
              Salary Disbursement History — {selectedMonth} {selectedYear}
            </h3>
            <span className="text-xs text-gray-500">
              Showing {filteredDisbursements.length} employee payslips
            </span>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="text-left px-4 py-3 font-semibold uppercase">Employee</th>
                <th className="text-left px-4 py-3 font-semibold uppercase">Designation</th>
                <th className="text-left px-4 py-3 font-semibold uppercase">Date</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Base Salary</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Allowances</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Deductions</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Net Disbursed</th>
                <th className="text-center px-4 py-3 font-semibold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No payroll disbursements logged for {selectedMonth} {selectedYear}. Click "Disburse Payroll" to process salaries.
                  </td>
                </tr>
              ) : (
                filteredDisbursements.map((pay: any) => (
                  <tr key={pay.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{pay.employee_name}</td>
                    <td className="px-4 py-3 text-gray-600">{pay.designation || 'Staff'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{pay.disbursed_date}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{formatAmount(pay.base_salary)}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">+{formatAmount(pay.allowance)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">-{formatAmount(pay.deductions)}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatAmount(pay.net_salary)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Employee Directory */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employeeContacts.length === 0 ? (
            <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-gray-700 mb-1">No Employee Records Found</p>
              <p className="text-xs text-gray-400 mb-4">Click "Add Employee" above to maintain your team's HR records.</p>
            </div>
          ) : (
            employeeContacts.map((emp: any) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-base">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{emp.name}</h3>
                    <p className="text-xs text-gray-500">{emp.company || 'Employee'}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 pt-3 border-t border-gray-100">
                  {emp.email && <p>📧 {emp.email}</p>}
                  {emp.phone && <p>📞 {emp.phone}</p>}
                  <p className="font-medium text-gray-800">💰 Est. Salary: ₹50,000 / month</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Employee Loans */}
      {activeTab === 'loans' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Internal Employee Loans & Advances</h3>
            <button
              onClick={() => setIsLoanModalOpen(true)}
              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg"
            >
              + Issue Loan
            </button>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="text-left px-4 py-3 font-semibold uppercase">Loan Name / Employee</th>
                <th className="text-left px-4 py-3 font-semibold uppercase">Start Date</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Principal Loan</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Monthly EMI</th>
                <th className="text-right px-4 py-3 font-semibold uppercase">Outstanding</th>
                <th className="text-center px-4 py-3 font-semibold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.filter((l: any) => l.type === 'EMPLOYEE' || l.institution === 'Internal HR').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No internal employee loans recorded yet.
                  </td>
                </tr>
              ) : (
                loans
                  .filter((l: any) => l.type === 'EMPLOYEE' || l.institution === 'Internal HR')
                  .map((loan: any) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{loan.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono">{loan.start_date}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{formatAmount(loan.principal)}</td>
                      <td className="px-4 py-3 text-right font-medium text-purple-600">{formatAmount(loan.emi_amount)}/mo</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{formatAmount(loan.outstanding_balance)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Employee Record</h3>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEmployeeMutation.mutate(empForm);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={empForm.name}
                  onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Software Engineer"
                    value={empForm.designation}
                    onChange={(e) => setEmpForm((f) => ({ ...f, designation: e.target.value, company: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="suresh@company.com"
                  value={empForm.email}
                  onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Base Salary (₹)</label>
                  <input
                    type="number"
                    value={empForm.base_salary}
                    onChange={(e) => setEmpForm((f) => ({ ...f, base_salary: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    value={empForm.allowances}
                    onChange={(e) => setEmpForm((f) => ({ ...f, allowances: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    value={empForm.deductions}
                    onChange={(e) => setEmpForm((f) => ({ ...f, deductions: e.target.value }))}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveEmployeeMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {saveEmployeeMutation.isPending ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Loan Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Issue Employee Advance / Loan</h3>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveLoanMutation.mutate(loanForm);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={loanForm.employee_name}
                  onChange={(e) => setLoanForm((f) => ({ ...f, employee_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Loan Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="25000"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Salary EMI (₹)</label>
                  <input
                    type="number"
                    placeholder="2500"
                    value={loanForm.emi}
                    onChange={(e) => setLoanForm((f) => ({ ...f, emi: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoanMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {saveLoanMutation.isPending ? 'Granting...' : 'Grant Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disburse Salary Modal */}
      {isDisburseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Disburse Payroll for {selectedMonth} {selectedYear}
              </h3>
              <button onClick={() => setIsDisburseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                This action will disburse monthly salaries to all active employees for{' '}
                <strong className="text-gray-900">{selectedMonth} {selectedYear}</strong> and generate payslip entries in your ledger.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Pay From Bank Account</label>
                <select
                  id="disburse_acc"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatAmount(a.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const accEl = document.getElementById('disburse_acc') as HTMLSelectElement;
                    handleDisburseAll(accEl?.value || accounts[0]?.id);
                  }}
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium"
                >
                  Confirm Disbursement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
