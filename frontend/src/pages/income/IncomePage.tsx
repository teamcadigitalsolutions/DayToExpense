import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { transactionService, accountService, categoryService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency, useDebounce } from '../../hooks';
import AmountCalculatorInput from '../../components/AmountCalculatorInput';

const EMPTY_FORM = {
  account_id: '',
  category_id: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
};

export default function IncomePage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['income', wsId, debouncedSearch],
    queryFn: () => transactionService.list(wsId, { type: 'INCOME', search: debouncedSearch || undefined, size: 200 }),
    enabled: !!wsId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId, 'INCOME'],
    queryFn: () => categoryService.list(wsId, 'INCOME'),
    enabled: !!wsId,
  });

  const accMap = new Map(accounts.map((a: any) => [a.id, a.name]));
  const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

  const rawTransactions = data?.items ?? [];
  const transactions = [...rawTransactions].sort((a: any, b: any) => {
    const da = new Date(a.date).getTime();
    const db_ = new Date(b.date).getTime();
    return sortDir === 'desc' ? db_ - da : da - db_;
  });
  const total = rawTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['income', wsId] });
    qc.invalidateQueries({ queryKey: ['transactions', wsId] });
    qc.invalidateQueries({ queryKey: ['accounts', wsId] });
    qc.invalidateQueries({ queryKey: ['dashboard', wsId] });
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingTx(null);
    setForm({ ...EMPTY_FORM });
  };

  const createMutation = useMutation({
    mutationFn: (newIncome: any) =>
      transactionService.create(wsId, {
        ...newIncome,
        type: 'INCOME',
        amount: parseFloat(newIncome.amount),
      }),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) =>
      transactionService.update(wsId, id, { ...d, amount: parseFloat(d.amount) }),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionService.delete(wsId, id),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const accId = form.account_id || accounts[0]?.id;
    if (!accId || !form.amount || !form.date) return;
    const payload = { ...form, account_id: accId };
    if (editingTx) {
      updateMutation.mutate({ id: editingTx.id, d: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openEdit = (tx: any) => {
    setEditingTx(tx);
    setForm({
      account_id: tx.account_id || '',
      category_id: tx.category_id || '',
      amount: String(tx.amount),
      date: tx.date ? String(tx.date).split('T')[0] : new Date().toISOString().split('T')[0],
      description: tx.description || '',
    });
    setIsOpen(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 font-medium">Total Income</p>
          <p className="text-2xl font-bold text-green-600">{formatAmount(total)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search income..."
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <button
            onClick={() => { setEditingTx(null); setForm({ ...EMPTY_FORM }); setIsOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus size={16} /> Add Income
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              >
                <span className="flex items-center gap-1">
                  Date {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Account</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No income records found
                </td>
              </tr>
            ) : (
              transactions.map((tx: any) => {
                const categoryLabel = tx.category_name || (tx.category_id ? catMap.get(tx.category_id) : null);
                const accountLabel = tx.account_name || (tx.account_id ? accMap.get(tx.account_id) : null) || '—';
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{tx.description || categoryLabel || 'Income'}</td>
                    <td className="px-4 py-3">
                      {categoryLabel ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                          {categoryLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium">{accountLabel}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatAmount(tx.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(tx)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(tx.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Delete Income Entry?</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm!)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingTx ? 'Edit Income Entry' : 'Add Income Entry'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Destination Account</label>
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
                    placeholder="500 + 250"
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Description / Source</label>
                <input
                  type="text"
                  placeholder="e.g. Salary, Client Payment, Project Dividend"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : editingTx ? 'Update Income' : 'Save Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

