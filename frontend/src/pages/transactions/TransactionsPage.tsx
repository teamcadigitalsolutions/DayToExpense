import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { transactionService, accountService, categoryService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';
import AmountCalculatorInput from '../../components/AmountCalculatorInput';

const TYPE_BADGE: Record<string, string> = {
  INCOME: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-blue-100 text-blue-700',
};

export default function TransactionsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'EXPENSE',
    account_id: '',
    category_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', wsId, debouncedSearch, filterType, page],
    queryFn: () => transactionService.list(wsId, { search: debouncedSearch, type: filterType || undefined, page, size: 50 }),
    enabled: !!wsId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId, form.type],
    queryFn: () => categoryService.list(wsId, form.type),
    enabled: !!wsId,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories', wsId, 'ALL'],
    queryFn: () => categoryService.list(wsId),
    enabled: !!wsId,
  });

  const accMap = new Map(accounts.map((a: any) => [a.id, a.name]));
  const catMap = new Map(allCategories.map((c: any) => [c.id, c.name]));

  const transactions = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (newTx: any) => transactionService.create(wsId, newTx),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', wsId] });
      qc.invalidateQueries({ queryKey: ['accounts', wsId] });
      qc.invalidateQueries({ queryKey: ['dashboard', wsId] });
      setIsOpen(false);
      setForm({
        type: 'EXPENSE',
        account_id: '',
        category_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionService.delete(wsId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions', wsId] });
      qc.invalidateQueries({ queryKey: ['accounts', wsId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accId = form.account_id || accounts[0]?.id;
    if (!accId || !form.amount || !form.date) return;

    createMutation.mutate({
      ...form,
      account_id: accId,
      amount: parseFloat(form.amount),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 w-full">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="">All Types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      <div className="w-full max-w-full bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full min-w-[650px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => {
                const accountLabel = tx.account_name || (tx.account_id ? accMap.get(tx.account_id) : null);
                const categoryLabel = tx.category_name || (tx.category_id ? catMap.get(tx.category_id) : null);
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{tx.description || categoryLabel || 'Transaction'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {categoryLabel && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                            {categoryLabel}
                          </span>
                        )}
                        {accountLabel && <span className="text-xs text-gray-500 font-medium">{accountLabel}</span>}
                      </div>
                    </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'text-xs px-2.5 py-0.5 rounded-full font-medium ' +
                        (TYPE_BADGE[tx.type] ?? 'bg-gray-100 text-gray-700')
                      }
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td
                    className={
                      'px-4 py-3 text-right font-semibold ' +
                      (tx.type === 'INCOME' ? 'text-green-600' : tx.type === 'EXPENSE' ? 'text-red-600' : 'text-blue-600')
                    }
                  >
                    {tx.type === 'EXPENSE' ? '-' : ''}
                    {formatAmount(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        if (confirm('Delete this transaction?')) deleteMutation.mutate(tx.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        {total > 50 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page * 50 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Add New Transaction</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Transaction Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, category_id: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
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
                    placeholder="1000 + 500"
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Grocery purchase at D-Mart"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
                  {createMutation.isPending ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
