import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { invoiceService, contactService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

const EMPTY_FORM = {
  customer_id: '',
  date: new Date().toISOString().split('T')[0],
  due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
  description: 'Consulting / Professional Services',
  quantity: '1',
  unit_price: '',
  tax_rate: '18',
  status: 'DRAFT',
  notes: '',
};

export default function InvoicesPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', wsId],
    queryFn: () => invoiceService.list(wsId),
    enabled: !!wsId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', wsId, 'CUSTOMER'],
    queryFn: () => contactService.list(wsId, { type: 'CUSTOMER' }),
    enabled: !!wsId,
  });

  const invoices = (data as any)?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices', wsId] });
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingInvoice(null);
    setForm({ ...EMPTY_FORM });
  };

  const createMutation = useMutation({
    mutationFn: (newInvoice: any) => invoiceService.create(wsId, newInvoice),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: any }) => invoiceService.update(wsId, id, d),
    onSuccess: () => { invalidate(); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoiceService.delete(wsId, id),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingInvoice) {
      updateMutation.mutate({
        id: editingInvoice.id,
        d: {
          customer_id: form.customer_id || undefined,
          due_date: form.due_date,
          status: form.status,
          notes: form.notes || undefined,
        },
      });
    } else {
      if (!form.unit_price) return;
      createMutation.mutate({
        customer_id: form.customer_id || undefined,
        date: form.date,
        due_date: form.due_date,
        items: [
          {
            description: form.description,
            quantity: parseFloat(form.quantity || '1'),
            unit_price: parseFloat(form.unit_price),
            tax_rate: parseFloat(form.tax_rate || '0'),
          },
        ],
      });
    }
  };

  const openEdit = (inv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingInvoice(inv);
    setForm({
      customer_id: inv.customer_id || '',
      date: inv.date ? String(inv.date).split('T')[0] : new Date().toISOString().split('T')[0],
      due_date: inv.due_date ? String(inv.due_date).split('T')[0] : new Date().toISOString().split('T')[0],
      description: '',
      quantity: '1',
      unit_price: '',
      tax_rate: '0',
      status: inv.status || 'DRAFT',
      notes: inv.notes || '',
    });
    setIsOpen(true);
  };

  const openAdd = () => {
    setEditingInvoice(null);
    setForm({ ...EMPTY_FORM });
    setIsOpen(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Invoices</h2>
          <p className="text-xs text-gray-500">Create, send, and track business invoices</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}>
                    <div className="h-10 bg-gray-100 m-2 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No invoices created yet
                </td>
              </tr>
            ) : (
              invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'text-xs px-2.5 py-0.5 rounded-full font-medium ' +
                        (STATUS_COLORS[inv.status] ?? 'bg-gray-100 text-gray-600')
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(inv.total)}</td>
                  <td className={'px-4 py-3 text-right font-semibold ' + (Number(inv.balance) > 0 ? 'text-red-600' : 'text-green-600')}>
                    {formatAmount(inv.balance)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => openEdit(inv, e)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Status / Due Date"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(inv.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Delete Invoice?</h3>
            <p className="text-sm text-gray-500">This action will delete the invoice record permanently.</p>
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

      {/* Add / Edit Invoice Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer / Client</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select Customer (Optional)</option>
                  {contacts.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingInvoice ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIALLY_PAID">Partially Paid</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!editingInvoice && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Item Description</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Web Development Services"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                      <input
                        type="number"
                        required
                        value={form.quantity}
                        onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="15000"
                        value={form.unit_price}
                        onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">GST %</label>
                      <input
                        type="number"
                        value={form.tax_rate}
                        onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingInvoice && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Memo</label>
                  <textarea
                    rows={3}
                    placeholder="Add any terms, bank details, or notes..."
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
              )}

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
                  {isPending ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
