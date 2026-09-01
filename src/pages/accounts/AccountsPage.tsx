import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet, TrendingUp, CreditCard, Landmark, X, Edit2, Trash2 } from 'lucide-react';
import { accountService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

const TYPE_ICONS: Record<string, any> = {
  SAVINGS: Wallet, CURRENT: Wallet, CASH: Wallet,
  CREDIT_CARD: CreditCard, LOAN: Landmark, INVESTMENT: TrendingUp, WALLET: Wallet,
};

const TYPE_COLORS: Record<string, string> = {
  SAVINGS: 'bg-blue-100 text-blue-700', CURRENT: 'bg-green-100 text-green-700',
  CASH: 'bg-yellow-100 text-yellow-700', CREDIT_CARD: 'bg-red-100 text-red-700',
  LOAN: 'bg-orange-100 text-orange-700', INVESTMENT: 'bg-teal-100 text-teal-700',
  WALLET: 'bg-purple-100 text-purple-700',
};

export default function AccountsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    account_type: 'SAVINGS',
    bank_name: '',
    opening_balance: '0',
    currency_code: 'INR',
    color: '#3b82f6',
    notes: '',
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  const totalBalance = accounts
    .filter((a: any) => !['CREDIT_CARD', 'LOAN'].includes(a.account_type))
    .reduce((sum: number, a: any) => sum + Number(a.current_balance || a.opening_balance || 0), 0);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingAccount) {
        return accountService.update(wsId, editingAccount.id, data);
      }
      return accountService.create(wsId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', wsId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', wsId] });
    },
  });

  const openAdd = () => {
    setEditingAccount(null);
    setForm({
      name: '',
      account_type: 'SAVINGS',
      bank_name: '',
      opening_balance: '0',
      currency_code: 'INR',
      color: '#3b82f6',
      notes: '',
    });
    setIsOpen(true);
  };

  const openEdit = (account: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount(account);
    setForm({
      name: account.name || '',
      account_type: account.account_type || 'SAVINGS',
      bank_name: account.bank_name || '',
      opening_balance: String(account.opening_balance || 0),
      currency_code: account.currency_code || 'INR',
      color: account.color || '#3b82f6',
      notes: account.notes || '',
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingAccount(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    saveMutation.mutate({
      ...form,
      opening_balance: parseFloat(form.opening_balance || '0'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-500">Total Available Balance</h2>
          <p className="text-3xl font-bold text-gray-900">{formatAmount(totalBalance)}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account: any) => {
            const Icon = TYPE_ICONS[account.account_type] ?? Wallet;
            const colorClass = TYPE_COLORS[account.account_type] ?? 'bg-gray-100 text-gray-700';
            return (
              <div
                key={account.id}
                className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-all shadow-sm hover:shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    style={{ backgroundColor: account.color ?? '#3b82f6' }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={'text-xs px-2.5 py-0.5 rounded-full font-medium ' + colorClass}>
                      {account.account_type.replace('_', ' ')}
                    </span>
                    <button
                      onClick={(e) => openEdit(account, e)}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                      title="Edit Account"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${account.name}"?`)) {
                          deleteMutation.mutate(account.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="font-semibold text-gray-900">{account.name}</p>
                {account.bank_name && <p className="text-xs text-gray-500">{account.bank_name}</p>}

                <p className="text-xl font-bold mt-3 text-gray-900">{formatAmount(account.current_balance)}</p>
                {account.credit_limit && (
                  <p className="text-xs text-gray-500 mt-1">Credit Limit: {formatAmount(account.credit_limit)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingAccount ? 'Edit Account' : 'Add New Account'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Salary Account"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Type</label>
                  <select
                    value={form.account_type}
                    onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="SAVINGS">Savings</option>
                    <option value="CURRENT">Current</option>
                    <option value="CASH">Cash</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="WALLET">Digital Wallet</option>
                    <option value="INVESTMENT">Investment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank / Institution</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank"
                    value={form.bank_name}
                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Account Color:</label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded border-none cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : editingAccount ? 'Update Account' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
