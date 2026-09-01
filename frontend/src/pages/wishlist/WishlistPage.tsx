import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, Plus, X, Pencil, Trash2, CheckSquare, Square, DollarSign, ListPlus, CircleDollarSign, AlertCircle, ShoppingCart
} from 'lucide-react';
import { wishlistService, accountService, categoryService } from '../../services';
import { useAuthStore } from '../../stores/authStore';
import { useCurrency } from '../../hooks';

const UNITS = ['pcs', 'kg', 'L', 'pack', 'g', 'ml', 'box', 'dozen'];

export default function WishlistPage() {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const { formatAmount } = useCurrency();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<any>(null);

  // Forms State
  const [form, setForm] = useState({
    name: '',
    quantity: '1',
    unit: 'pcs',
    price: '',
    notes: '',
  });

  const [purchaseForm, setPurchaseForm] = useState({
    account_id: '',
    category_id: 'cat-exp-02', // Food & Groceries
    price: '',
    record_expense: true,
  });

  const [advanceForm, setAdvanceForm] = useState({
    account_id: '',
    category_id: 'cat-inc-08', // Other Income
    amount: '',
    notes: '',
  });

  // Queries
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist', wsId],
    queryFn: () => wishlistService.list(wsId),
    enabled: !!wsId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', wsId],
    queryFn: () => accountService.list(wsId),
    enabled: !!wsId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', wsId],
    queryFn: () => categoryService.list(wsId),
    enabled: !!wsId,
  });

  // Filter Categories
  const expenseCategories = categories.filter((c: any) => c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c: any) => c.type === 'INCOME');

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => wishlistService.create(wsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => wishlistService.update(wsId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wishlistService.delete(wsId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => wishlistService.purchase(wsId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', wsId] });
      setIsPurchaseOpen(false);
      setActiveItem(null);
    },
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => wishlistService.recordAdvance(wsId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', wsId] });
      setIsAdvanceOpen(false);
      setActiveItem(null);
    },
  });

  // Modal Handlers
  const closeModal = () => {
    setIsOpen(false);
    setEditingItem(null);
    setForm({
      name: '',
      quantity: '1',
      unit: 'pcs',
      price: '',
      notes: '',
    });
  };

  const openAdd = () => {
    setEditingItem(null);
    setIsOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      price: item.price ? String(item.price) : '',
      notes: item.notes || '',
    });
    setIsOpen(true);
  };

  const openPurchase = (item: any) => {
    setActiveItem(item);
    setPurchaseForm({
      account_id: accounts[0]?.id || '',
      category_id: 'cat-exp-02',
      price: item.price ? String(item.price) : '',
      record_expense: true,
    });
    setIsPurchaseOpen(true);
  };

  const openAdvance = (item: any) => {
    setActiveItem(item);
    setAdvanceForm({
      account_id: accounts[0]?.id || '',
      category_id: 'cat-inc-08',
      amount: item.price ? String(parseFloat(item.price) * parseFloat(item.quantity)) : '',
      notes: `Advance for buying ${item.name}`,
    });
    setIsAdvanceOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      quantity: parseFloat(form.quantity || '1'),
      unit: form.unit,
      price: form.price ? parseFloat(form.price) : undefined,
      notes: form.notes || undefined,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    purchaseMutation.mutate({
      id: activeItem.id,
      data: {
        account_id: purchaseForm.account_id,
        category_id: purchaseForm.category_id,
        price: purchaseForm.price ? parseFloat(purchaseForm.price) : undefined,
        record_expense: purchaseForm.record_expense,
      },
    });
  };

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    advanceMutation.mutate({
      id: activeItem.id,
      data: {
        account_id: advanceForm.account_id,
        category_id: advanceForm.category_id,
        amount: parseFloat(advanceForm.amount),
        notes: advanceForm.notes,
      },
    });
  };

  const pendingItems = wishlist.filter((i: any) => !i.is_purchased);
  const purchasedItems = wishlist.filter((i: any) => i.is_purchased);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" /> Market Wishlist & Shopping Tracker
          </h2>
          <p className="text-xs text-gray-500">Plan purchases, track quantities, and optionally log them instantly as expenses or advances</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: List Pending Items */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <ShoppingCart size={16} className="text-amber-500" /> Shopping List ({pendingItems.length} items)
            </h3>

            {isLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No items on your list! Click "Add Item" to add groceries, vegetables, or household supplies.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-3.5 group">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => openPurchase(item)}
                        className="text-gray-400 hover:text-green-600 transition-colors mt-0.5"
                        title="Mark as Purchased"
                      >
                        <Square size={18} />
                      </button>
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                        <p className="text-[11px] text-gray-500">
                          Qty: <span className="font-bold text-gray-700">{item.quantity} {item.unit}</span>
                          {item.price && ` • Est. Price: ₹${item.price}/${item.unit}`}
                        </p>
                        {item.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">{item.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openAdvance(item)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Someone gave money for this (Record Income)"
                      >
                        <CircleDollarSign size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Item"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: List Recently Purchased Items */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <CheckSquare size={16} className="text-green-500" /> Recently Purchased
            </h3>

            {purchasedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No items checked off yet. Mark items on the left to see them here!
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto pr-1">
                {purchasedItems.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between group">
                    <div className="flex items-start gap-2.5">
                      <button
                        onClick={() => updateMutation.mutate({ id: item.id, data: { is_purchased: false } })}
                        className="text-green-600 hover:text-gray-400 transition-colors mt-0.5"
                        title="Mark as Pending"
                      >
                        <CheckSquare size={16} />
                      </button>
                      <div>
                        <h4 className="font-medium text-gray-500 text-sm line-through truncate max-w-[120px]">{item.name}</h4>
                        <p className="text-[10px] text-gray-400">
                          {item.quantity} {item.unit} • {item.price ? `₹${item.price} total` : 'No price logged'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Item"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Wishlist Item Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingItem ? 'Edit Item' : 'Add Item to Wishlist'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Item Name / Vegetable / Grocery</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tomatoes, Fresh Milk"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Unit Price (₹ - Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 40"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Extra Info</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Buy red ones only, or store names..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Purchase Modal */}
      {isPurchaseOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Mark "{activeItem.name}" as Purchased</h3>
              <button onClick={() => setIsPurchaseOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Actual Price per Unit (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50"
                  value={purchaseForm.price}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Total price will be: ₹{((parseFloat(purchaseForm.price) || 0) * activeItem.quantity).toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="record_exp"
                  checked={purchaseForm.record_expense}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, record_expense: e.target.checked }))}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="record_exp" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Save as expense entry in transactions list
                </label>
              </div>

              {purchaseForm.record_expense && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pay From Account</label>
                    <select
                      value={purchaseForm.account_id}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, account_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name} (₹{parseFloat(a.current_balance).toLocaleString('en-IN')})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Expense Category</label>
                    <select
                      value={purchaseForm.category_id}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, category_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                      {expenseCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg font-medium shadow-sm"
                >
                  {purchaseMutation.isPending ? 'Processing...' : 'Complete Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Advance Modal */}
      {isAdvanceOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Record Advance for "{activeItem.name}"</h3>
              <button onClick={() => setIsAdvanceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Advance Amount Received (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 500"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Deposit To Account</label>
                  <select
                    value={advanceForm.account_id}
                    onChange={(e) => setAdvanceForm((f) => ({ ...f, account_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name} (₹{parseFloat(a.current_balance).toLocaleString('en-IN')})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Income Category</label>
                  <select
                    value={advanceForm.category_id}
                    onChange={(e) => setAdvanceForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {incomeCategories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Given by mom for groceries"
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advanceMutation.isPending}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium shadow-sm"
                >
                  {advanceMutation.isPending ? 'Recording...' : 'Record Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
