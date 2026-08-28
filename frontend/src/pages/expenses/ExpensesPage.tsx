import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { transactionService, accountService, categoryService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';
import AmountCalculatorInput from '../../components/AmountCalculatorInput';
import { autoSuggestCategory } from '../../utils/autoCategorize';

export default function ExpensesPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    account_id: '',
    category_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expense', wsId, debouncedSearch],
    queryFn: () => transactionService.list(wsId, { type: 'EXPENSE', search: debouncedSearch || undefined }),
    enabled: !!wsId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId, 'EXPENSE'],
    queryFn: () => categoryService.list(wsId, 'EXPENSE'),
    enabled: !!wsId,
  });

  const transactions = data?.items ?? [];
  const total = transactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const createMutation = useMutation({
    mutationFn: (newExpense: any) =>
      transactionService.create(wsId, {
        ...newExpense,
        type: 'EXPENSE',
        amount: parseFloat(newExpense.amount),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense', wsId] });
      qc.invalidateQueries({ queryKey: ['transactions', wsId] });
      qc.invalidateQueries({ queryKey: ['accounts', wsId] });
      qc.invalidateQueries({ queryKey: ['dashboard', wsId] });
      setIsOpen(false);
      setForm({
        account_id: '',
        category_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accId = form.account_id || accounts[0]?.id;
    if (!accId || !form.amount || !form.date) return;
    createMutation.mutate({
      ...form,
      account_id: accId,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 font-medium">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatAmount(total)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses..."
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  No expense records found
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 font-mono">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tx.description || tx.category_name || 'Expense'}</td>
                  <td className="px-4 py-3">
                    {tx.category_name && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                        {tx.category_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{formatAmount(tx.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add Expense Entry</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Source Account</label>
                <select
                  required
                  value={form.account_id}
                  onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Account</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatAmount(a.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <AmountCalculatorInput
                    required
                    value={form.amount}
                    onChange={(val) => setForm((f) => ({ ...f, amount: val }))}
                    placeholder="120 + 350"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">Description / Merchant</label>
                  <span className="text-[10px] text-blue-600 font-semibold">✨ Smart Auto-Categorization</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Swiggy, HPCL Petrol, D-Mart, Electricity"
                  value={form.description}
                  onChange={(e) => {
                    const desc = e.target.value;
                    setForm((f) => {
                      const updated = { ...f, description: desc };
                      const matchedCat = autoSuggestCategory(desc, categories);
                      if (matchedCat) {
                        updated.category_id = matchedCat.id;
                      }
                      return updated;
                    });
                  }}
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
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
