import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, DollarSign, Calendar, Plus, Search, Edit2, Trash2, Landmark, CheckCircle, FileText, X, ChevronDown, UserCheck, Pencil
} from 'lucide-react';
import { contactService, loanService, transactionService, accountService, settingsService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = ['2026', '2025', '2024', '2023'];

const EMPTY_EMP_FORM = {
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
};

const EMPTY_LOAN_FORM = {
  id: '',
  employee_name: '',
  amount: '',
  emi: '',
  outstanding_balance: '',
  status: 'ACTIVE',
  notes: '',
};

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

  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'employee' | 'loan' | 'payslip'; id: string } | null>(null);

  // Employee Form State
  const [empForm, setEmpForm] = useState({ ...EMPTY_EMP_FORM });

  // Loan Form State
  const [loanForm, setLoanForm] = useState({ ...EMPTY_LOAN_FORM });

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

  // DB-backed Payroll Disbursements State
  const [disbursements, setDisbursements] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(`payroll_disbursements_${wsId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (wsId) {
      settingsService.get(wsId, `payroll_disbursements_${wsId}`).then((data) => {
        if (Array.isArray(data)) {
          setDisbursements(data);
        }
        setIsLoaded(true);
      }).catch(() => setIsLoaded(true));
    }
  }, [wsId]);

  useEffect(() => {
    if (wsId && isLoaded) {
      localStorage.setItem(`payroll_disbursements_${wsId}`, JSON.stringify(disbursements));
      settingsService.save(wsId, `payroll_disbursements_${wsId}`, disbursements);
    }
  }, [disbursements, wsId, isLoaded]);

  // Employee Save/Update Mutation
  const saveEmployeeMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        name: data.name,
        company: data.designation || data.company,
        email: data.email || undefined,
        phone: data.phone || undefined,
        notes: `Base: ${data.base_salary || '0'}, Allowances: ${data.allowances || '0'}, Deductions: ${data.deductions || '0'}`,
      };
      if (data.id) {
        return contactService.update(wsId, data.id, payload);
      }
      return contactService.create(wsId, { ...payload, type: 'EMPLOYEE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', wsId] });
      setIsEmployeeModalOpen(false);
      setEditingEmployee(null);
      setEmpForm({ ...EMPTY_EMP_FORM });
    },
  });

  // Employee Delete Mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: (id: string) => contactService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', wsId] });
      setDeleteConfirm(null);
    },
  });

  // Employee Loan Save/Update Mutation
  const saveLoanMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        name: data.id ? data.name : `Employee Loan - ${data.employee_name}`,
        principal: parseFloat(data.amount),
        emi_amount: parseFloat(data.emi || String(parseFloat(data.amount) / 10)),
        outstanding_balance: parseFloat(data.outstanding_balance || data.amount),
        status: data.status || 'ACTIVE',
        notes: data.notes || undefined,
      };
      if (data.id) {
        return loanService.update(wsId, data.id, payload);
      }
      return loanService.create(wsId, {
        ...payload,
        type: 'EMPLOYEE',
        institution: 'Internal HR',
        interest_rate: 0,
        tenure_months: 10,
        start_date: new Date().toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', wsId] });
      setIsLoanModalOpen(false);
      setEditingLoan(null);
      setLoanForm({ ...EMPTY_LOAN_FORM });
    },
  });

  // Loan Delete Mutation
  const deleteLoanMutation = useMutation({
    mutationFn: (id: string) => loanService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', wsId] });
      setDeleteConfirm(null);
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
      // Parse custom notes if salary info is saved there
      let base = 50000;
      let allowance = 3000;
      let deds = 1500;
      if (emp.notes) {
        const baseMatch = emp.notes.match(/Base:\s*(\d+)/);
        const allowMatch = emp.notes.match(/Allowances:\s*(\d+)/);
        const dedsMatch = emp.notes.match(/Deductions:\s*(\d+)/);
        if (baseMatch) base = parseInt(baseMatch[1]);
        if (allowMatch) allowance = parseInt(allowMatch[1]);
        if (dedsMatch) deds = parseInt(dedsMatch[1]);
      }
      const net = base + allowance - deds;
      return {
        id: 'pay-' + Date.now() + '-' + Math.random().toString().slice(2, 6),
        employee_name: emp.name,
        designation: emp.company || 'Team Member',
        department: 'General',
        year: selectedYear,
        month: selectedMonth,
        disbursed_date: new Date().toISOString().split('T')[0],
        base_salary: base,
        allowance: allowance,
        deductions: deds,
        net_salary: net,
        status: 'PAID',
      };
    });

    setDisbursements((prev) => [...prev, ...newEntries]);
    setIsDisburseModalOpen(false);
  };

  const openEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    let base = '', allowances = '', deductions = '';
    if (emp.notes) {
      const baseMatch = emp.notes.match(/Base:\s*(\d+)/);
      const allowMatch = emp.notes.match(/Allowances:\s*(\d+)/);
      const dedsMatch = emp.notes.match(/Deductions:\s*(\d+)/);
      if (baseMatch) base = baseMatch[1];
      if (allowMatch) allowances = allowMatch[1];
      if (dedsMatch) deductions = dedsMatch[1];
    }
    setEmpForm({
      id: emp.id,
      name: emp.name || '',
      designation: emp.company || '',
      department: 'General',
      company: emp.company || '',
      email: emp.email || '',
      phone: emp.phone || '',
      base_salary: base,
      allowances: allowances,
      deductions: deductions,
    });
    setIsEmployeeModalOpen(true);
  };

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setEmpForm({ ...EMPTY_EMP_FORM });
    setIsEmployeeModalOpen(true);
  };

  const openEditLoan = (loan: any) => {
    setEditingLoan(loan);
    setLoanForm({
      id: loan.id,
      employee_name: loan.name.replace('Employee Loan - ', ''),
      amount: String(loan.principal || 0),
      emi: String(loan.emi_amount || 0),
      outstanding_balance: String(loan.outstanding_balance || 0),
      status: loan.status || 'ACTIVE',
      notes: loan.notes || '',
    });
    setIsLoanModalOpen(true);
  };

  const openAddLoan = () => {
    setEditingLoan(null);
    setLoanForm({ ...EMPTY_LOAN_FORM });
    setIsLoanModalOpen(true);
  };

  const handleDeletePayslip = (payslipId: string) => {
    setDisbursements((prev) => prev.filter((p) => p.id !== payslipId));
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'employee') {
      deleteEmployeeMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'loan') {
      deleteLoanMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'payslip') {
      handleDeletePayslip(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const isPending = saveEmployeeMutation.isPending || saveLoanMutation.isPending;

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
            onClick={openAddEmployee}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Plus size={15} /> Add Employee
          </button>
          <button
            onClick={openAddLoan}
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
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
                <th className="text-center px-4 py-3 font-semibold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
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
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeleteConfirm({ type: 'payslip', id: pay.id })}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        title="Delete Payslip Entry"
                      >
                        <Trash2 size={14} />
                      </button>
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
            employeeContacts.map((emp: any) => {
              // Parse notes if salary details are there
              let base = '50,000';
              if (emp.notes) {
                const match = emp.notes.match(/Base:\s*(\d+)/);
                if (match) base = parseInt(match[1]).toLocaleString('en-IN');
              }
              return (
                <div key={emp.id} className="group relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow hover:border-blue-300 transition-all">
                  <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditEmployee(emp)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Edit Employee"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'employee', id: emp.id })}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete Employee"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

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
                    <p className="font-medium text-gray-800 font-mono">💰 Est. Salary: ₹{base} / mo</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 3: Employee Loans */}
      {activeTab === 'loans' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Internal Employee Loans & Advances</h3>
            <button
              onClick={openAddLoan}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg"
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
                <th className="text-center px-4 py-3 font-semibold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.filter((l: any) => l.type === 'EMPLOYEE' || l.institution === 'Internal HR').length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
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
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditLoan(loan)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Edit Loan Details"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'loan', id: loan.id })}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Delete Loan"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">
              Delete {deleteConfirm.type === 'employee' ? 'Employee Record' : deleteConfirm.type === 'loan' ? 'Employee Loan' : 'Salary Payslip'}?
            </h3>
            <p className="text-sm text-gray-500">
              This action cannot be undone. Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingEmployee ? 'Edit Employee Record' : 'Add Employee Record'}</h3>
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="suresh@company.com"
                  value={empForm.email}
                  onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Base Salary (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={empForm.base_salary}
                    onChange={(e) => setEmpForm((f) => ({ ...f, base_salary: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allowances (₹)</label>
                  <input
                    type="number"
                    placeholder="3000"
                    value={empForm.allowances}
                    onChange={(e) => setEmpForm((f) => ({ ...f, allowances: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    placeholder="1500"
                    value={empForm.deductions}
                    onChange={(e) => setEmpForm((f) => ({ ...f, deductions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : editingEmployee ? 'Update Record' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Loan Modal */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingLoan ? 'Edit Employee Loan' : 'Issue Employee Loan'}</h3>
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
                {editingLoan ? (
                  <input
                    type="text"
                    readOnly
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-500 focus:outline-none"
                    value={loanForm.employee_name}
                  />
                ) : (
                  <select
                    required
                    value={loanForm.employee_name}
                    onChange={(e) => setLoanForm((f) => ({ ...f, employee_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Select Employee</option>
                    {employeeContacts.map((emp: any) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Principal Amount (₹)</label>
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
                    required
                    placeholder="2500"
                    value={loanForm.emi}
                    onChange={(e) => setLoanForm((f) => ({ ...f, emi: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {editingLoan && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Outstanding Balance (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="15000"
                      value={loanForm.outstanding_balance}
                      onChange={(e) => setLoanForm((f) => ({ ...f, outstanding_balance: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={loanForm.status}
                      onChange={(e) => setLoanForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="CLOSED">Closed</option>
                      <option value="DEFAULTED">Defaulted</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={loanForm.notes}
                  onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                />
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
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : editingLoan ? 'Update Loan' : 'Grant Loan'}
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
