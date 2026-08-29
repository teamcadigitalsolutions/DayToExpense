import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Edit2, Trash2, Calendar, CreditCard, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { subscriptionService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

export default function SubscriptionsPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    billing_cycle: 'MONTHLY',
    next_billing_date: new Date().toISOString().split('T')[0],
    reminder_days: '3',
    status: 'ACTIVE',
    notes: '',
  });

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['subscriptions', wsId],
    queryFn: () => subscriptionService.list(wsId),
    enabled: !!wsId,
  });

  const totalMonthly = (subs as any[])
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => {
      const amt = Number(s.amount || 0);
      if (s.billing_cycle === 'MONTHLY') return sum + amt;
      if (s.billing_cycle === 'YEARLY') return sum + amt / 12;
      if (s.billing_cycle === 'QUARTERLY') return sum + amt / 3;
      if (s.billing_cycle === 'WEEKLY') return sum + amt * 4.33;
      return sum;
    }, 0);

  const resetForm = () => {
    setForm({
      name: '',
      amount: '',
      billing_cycle: 'MONTHLY',
      next_billing_date: new Date().toISOString().split('T')[0],
      reminder_days: '3',
      status: 'ACTIVE',
      notes: '',
    });
    setEditingSub(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEditModal = (sub: any) => {
    setEditingSub(sub);
    setForm({
      name: sub.name || '',
      amount: String(sub.amount || ''),
      billing_cycle: sub.billing_cycle || 'MONTHLY',
      next_billing_date: sub.next_billing_date || new Date().toISOString().split('T')[0],
      reminder_days: String(sub.reminder_days || '3'),
      status: sub.status || 'ACTIVE',
      notes: sub.notes || '',
    });
    setIsOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (newSub: any) => subscriptionService.create(wsId, newSub),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', wsId] });
      setIsOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) => subscriptionService.update(wsId, data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', wsId] });
      setIsOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', wsId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.amount) return;

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      reminder_days: parseInt(form.reminder_days || '3', 10),
    };

    if (editingSub) {
      updateMutation.mutate({ id: editingSub.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" subscription?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleStatus = (sub: any) => {
    const nextStatus = sub.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE';
    updateMutation.mutate({ id: sub.id, payload: { status: nextStatus } });
  };

  const getDaysTillRenewal = (dateStr: string) => {
    if (!dateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="text-blue-600" size={22} /> Recurring Subscriptions Studio
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Track streaming services, cloud software, memberships, and billing renewal dates
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Monthly Recurring Cost</span>
            <span className="text-2xl font-bold text-blue-600">{formatAmount(totalMonthly)}</span>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={16} /> Add Subscription
          </button>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)
        ) : subs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            No subscriptions tracked yet. Click "Add Subscription" to start tracking recurring bills.
          </div>
        ) : (
          (subs as any[]).map((s: any) => {
            const daysRem = getDaysTillRenewal(s.next_billing_date);
            const isDueSoon = daysRem >= 0 && daysRem <= Number(s.reminder_days || 3);
            const isActive = s.status === 'ACTIVE';

            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-gray-900 text-base">{s.name}</h3>
                    <button
                      onClick={() => handleToggleStatus(s)}
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
                        isActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {s.status}
                    </button>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-blue-600">{formatAmount(s.amount)}</span>
                    <span className="text-xs font-medium text-gray-500">/{s.billing_cycle.toLowerCase()}</span>
                  </div>

                  {s.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.notes}</p>}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Calendar size={13} className="text-gray-400" /> Next Billing:
                    </span>
                    <span className="font-semibold text-gray-800">{s.next_billing_date}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Clock size={13} className="text-gray-400" /> Status:
                    </span>
                    <span className={`font-semibold text-[11px] ${isDueSoon ? 'text-amber-600 font-bold' : 'text-gray-600'}`}>
                      {daysRem < 0 ? 'Billing Passed' : daysRem === 0 ? 'Due Today' : `Renews in ${daysRem} days`}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                      title="Edit Subscription"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      title="Delete Subscription"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Subscription Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingSub ? 'Edit Subscription' : 'Add New Subscription'}</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Service / App Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Spotify, AWS, ChatGPT"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Billing Cycle</label>
                  <select
                    value={form.billing_cycle}
                    onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="649"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Next Billing Date</label>
                  <input
                    type="date"
                    required
                    value={form.next_billing_date}
                    onChange={(e) => setForm((f) => ({ ...f, next_billing_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reminder (Days Before)</label>
                  <input
                    type="number"
                    value={form.reminder_days}
                    onChange={(e) => setForm((f) => ({ ...f, reminder_days: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Card Info</label>
                <input
                  type="text"
                  placeholder="e.g. Autopay on HDFC Credit Card"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingSub ? 'Update Subscription' : 'Save Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
