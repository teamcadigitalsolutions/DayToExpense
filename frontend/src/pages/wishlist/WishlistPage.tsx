import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, Plus, X, Pencil, Trash2, CheckSquare, Square, ListPlus,
  CircleDollarSign, ShoppingCart, Share2, Upload, Download, Copy, Check, MessageCircle
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
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

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
    category_id: '',
    price: '',
    record_expense: true,
  });

  const [advanceForm, setAdvanceForm] = useState({
    account_id: '',
    category_id: '',
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
      category_id: expenseCategories[0]?.id || '',
      price: item.price ? String(item.price) : '',
      record_expense: true,
    });
    setIsPurchaseOpen(true);
  };

  const openAdvance = (item: any) => {
    setActiveItem(item);
    setAdvanceForm({
      account_id: accounts[0]?.id || '',
      category_id: incomeCategories[0]?.id || '',
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

  const pendingEstTotal = pendingItems.reduce(
    (sum: number, i: any) => sum + (i.price ? Number(i.price) * Number(i.quantity) : 0),
    0
  );

  // Generate shareable text for WhatsApp or Clipboard
  const getShareText = () => {
    if (!pendingItems.length) return '🛒 Shopping List is empty!';
    let text = `🛒 *Shopping List (${currentWorkspace?.name ?? 'DayToExpense'})*:\n\n`;
    pendingItems.forEach((item: any, idx: number) => {
      const lineCost = item.price ? Number(item.price) * Number(item.quantity) : null;
      text += `${idx + 1}. *${item.name}* — ${item.quantity} ${item.unit}`;
      if (item.price) {
        text += ` (Est: ₹${item.price}/${item.unit}${lineCost ? ` = ₹${lineCost.toFixed(2)}` : ''})`;
      }
      text += `\n`;
    });

    if (pendingEstTotal > 0) {
      text += `\n💰 *Total Est. Price*: ₹${pendingEstTotal.toFixed(2)}`;
    }
    return text;
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyShare = () => {
    navigator.clipboard.writeText(getShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export JSON or TXT file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(wishlist, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Shopping_List_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportTXT = () => {
    const textStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(getShareText());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', textStr);
    downloadAnchor.setAttribute('download', `Shopping_List_${new Date().toISOString().split('T')[0]}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Parse Single Text Line safely
  const parseLine = (line: string) => {
    let clean = line.trim();
    if (!clean) return null;

    // Skip metadata / header lines
    if (
      /shopping list/i.test(clean) ||
      /total est/i.test(clean) ||
      /total price/i.test(clean) ||
      /total cost/i.test(clean) ||
      /est\.? price/i.test(clean)
    ) {
      return null;
    }

    // Strip leading line numbers, bullets, asterisks, emojis
    clean = clean
      .replace(/^[\d+[\.\)\-•\*📈💰🛒]+\s*/u, '')
      .replace(/^[•\-\*\d+\.]+\s*/, '')
      .trim();

    if (!clean) return null;

    // Extract trailing parenthetical price e.g. (Est: ₹10/pcs = ₹10.00)
    let extractedPrice: number | undefined = undefined;
    const parenMatch = clean.match(/\((?:Est:?\s*)?(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)/i);
    if (parenMatch) {
      extractedPrice = parseFloat(parenMatch[1]);
    }
    clean = clean.replace(/\(.*?\)/g, '').trim();

    // Strip WhatsApp markdown asterisks
    clean = clean.replace(/\*/g, '').trim();

    const dashParts = clean.split(/[\—\–\-:]+/);
    let name = dashParts[0].trim();
    let qty = 1;
    let unit = 'pcs';
    let price = extractedPrice;

    const rest = dashParts.slice(1).join(' ').trim();
    if (rest) {
      const qtyMatch = rest.match(/(\d+(?:\.\d+)?)\s*(pcs|kg|L|pack|g|ml|box|dozen)?(?:\s+(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?))?/i);
      if (qtyMatch) {
        qty = parseFloat(qtyMatch[1]);
        if (qtyMatch[2]) unit = qtyMatch[2].toLowerCase();
        if (qtyMatch[3] && !price) price = parseFloat(qtyMatch[3]);
      }
    } else {
      const match = name.match(/^(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(pcs|kg|L|pack|g|ml|box|dozen)?)?(?:\s+(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?))?$/i);
      if (match) {
        name = match[1].trim();
        if (match[2]) qty = parseFloat(match[2]);
        if (match[3]) unit = match[3].toLowerCase();
        if (match[4] && !price) price = parseFloat(match[4]);
      }
    }

    name = name.replace(/^[\*\_\-\—\:]+/, '').replace(/[\*\_\-\—\:]+$/, '').trim();
    if (!name || name.length < 2) return null;

    return { name, quantity: qty, unit, price };
  };

  // Parse Bulk Text / JSON Import
  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    if (!importText.trim()) return;

    setIsImporting(true);
    try {
      let itemsToImport: any[] = [];
      const trimmed = importText.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          itemsToImport = parsed.map((item) => ({
            name: item.name || item.title || 'Item',
            quantity: parseFloat(item.quantity || '1'),
            unit: item.unit || 'pcs',
            price: item.price ? parseFloat(item.price) : undefined,
            notes: item.notes || undefined,
          }));
        }
      } else {
        const lines = trimmed.split('\n');
        for (const l of lines) {
          const parsedItem = parseLine(l);
          if (parsedItem) {
            itemsToImport.push(parsedItem);
          }
        }
      }

      if (itemsToImport.length === 0) {
        setImportError('No valid items found to import.');
        setIsImporting(false);
        return;
      }

      // Execute bulk creation
      for (const item of itemsToImport) {
        await wishlistService.create(wsId, item);
      }

      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
      setIsImportOpen(false);
      setImportText('');
    } catch (err: any) {
      setImportError('Failed to parse import data. Please check format.');
    } finally {
      setIsImporting(false);
    }
  };

  // Clear all pending items helper
  const handleClearPending = async () => {
    if (confirm('Delete all items from shopping list?')) {
      for (const item of pendingItems) {
        await wishlistService.delete(wsId, item.id);
      }
      queryClient.invalidateQueries({ queryKey: ['wishlist', wsId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" /> Market Wishlist & Shopping Tracker
          </h2>
          <p className="text-xs text-gray-500">
            Plan purchases, share via WhatsApp, bulk import/export, and log as expenses seamlessly
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
            title="Share via WhatsApp or Clipboard"
          >
            <Share2 size={15} /> Share List
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200 transition-colors"
            title="Bulk Import List"
          >
            <Upload size={15} /> Bulk Import
          </button>

          <button
            onClick={handleExportJSON}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
            title="Export List as JSON"
          >
            <Download size={15} /> Export
          </button>

          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Items To Buy</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{pendingItems.length}</p>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <ShoppingCart size={20} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Est. Total Cost</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">{formatAmount(pendingEstTotal)}</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <CircleDollarSign size={20} />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-xl p-3.5 sm:p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Checked Off</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-0.5">{purchasedItems.length} items</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <CheckSquare size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: List Pending Items */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <ShoppingCart size={16} className="text-amber-500" /> Shopping List ({pendingItems.length} items)
              </h3>
              <div className="flex items-center gap-2">
                {pendingEstTotal > 0 && (
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Est: {formatAmount(pendingEstTotal)}
                  </span>
                )}
                {pendingItems.length > 0 && (
                  <button
                    onClick={handleClearPending}
                    className="text-[11px] font-medium text-red-500 hover:text-red-700 hover:underline"
                    title="Clear all pending items"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No items on your list! Click "Add Item" or "Bulk Import" to add groceries, vegetables, or household supplies.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-3.5 group gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => openPurchase(item)}
                        className="text-gray-400 hover:text-green-600 transition-colors mt-0.5 flex-shrink-0"
                        title="Mark as Purchased & Log Expense"
                      >
                        <Square size={18} />
                      </button>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h4>
                        <p className="text-[11px] text-gray-500">
                          Qty: <span className="font-bold text-gray-700">{item.quantity} {item.unit}</span>
                          {item.price && ` • Est. Price: ₹${item.price}/${item.unit}`}
                        </p>
                        {item.notes && <p className="text-[10px] text-gray-400 italic mt-0.5 truncate">{item.notes}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openAdvance(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Record Income / Advance for this item"
                      >
                        <CircleDollarSign size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Item"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 size={15} />
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
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <CheckSquare size={16} className="text-green-500" /> Recently Purchased ({purchasedItems.length})
            </h3>

            {purchasedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No items checked off yet. Check items on the list to move them here!
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto pr-1">
                {purchasedItems.map((item: any) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between group gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        onClick={() => updateMutation.mutate({ id: item.id, data: { is_purchased: false } })}
                        className="text-green-600 hover:text-gray-400 transition-colors mt-0.5 flex-shrink-0"
                        title="Uncheck Item"
                      >
                        <CheckSquare size={18} />
                      </button>
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-500 text-sm line-through truncate">{item.name}</h4>
                        <p className="text-[11px] text-gray-400">
                          {item.quantity} {item.unit}
                          {item.price && ` • ₹${item.price}/${item.unit}`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Delete Item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {isShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Share2 size={18} className="text-emerald-600" /> Share Shopping List
              </h3>
              <button onClick={() => setIsShareOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">List Preview</label>
                <textarea
                  readOnly
                  rows={6}
                  value={getShareText()}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleWhatsAppShare}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  <MessageCircle size={16} /> Send via WhatsApp
                </button>

                <button
                  onClick={handleCopyShare}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                <span>Or download file:</span>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportTXT} className="text-blue-600 font-semibold hover:underline">
                    .TXT File
                  </button>
                  <span>•</span>
                  <button onClick={handleExportJSON} className="text-blue-600 font-semibold hover:underline">
                    .JSON File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Upload size={18} className="text-purple-600" /> Bulk Import Shopping Items
              </h3>
              <button onClick={() => setIsImportOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBulkImportSubmit} className="p-6 space-y-4 overflow-y-auto">
              <p className="text-xs text-gray-600">
                Paste item lines below (e.g., <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700 font-mono">Green Chilli 1 pcs 10</code> or <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-700 font-mono">Milk 2 L 28</code>) or paste any shared WhatsApp list text or JSON array.
              </p>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                  {importError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Paste List / Text / JSON</label>
                <textarea
                  required
                  rows={8}
                  placeholder={`Green Chilli 1 pcs 10\nMilk 1 pcs 28\nOnions 2 kg 40\nBread 1 pack`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isImporting ? 'Importing Items...' : 'Import All Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingItem ? 'Edit Wishlist Item' : 'Add Item to Wishlist'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Green Chilli, Milk, Rice"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Est. Price per Unit (₹)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Optional e.g. 28"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes / Brand preference</label>
                <input
                  type="text"
                  placeholder="e.g. Organic, Amul brand"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {editingItem ? 'Save Changes' : 'Add to List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {isPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Mark Purchased: {activeItem?.name}</h3>
              <button onClick={() => setIsPurchaseOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Actual Purchase Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Total price paid"
                  value={purchaseForm.price}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="record_expense"
                  checked={purchaseForm.record_expense}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, record_expense: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="record_expense" className="text-xs font-medium text-gray-700">
                  Log directly as Expense Transaction
                </label>
              </div>

              {purchaseForm.record_expense && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Account</label>
                    <select
                      required
                      value={purchaseForm.account_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, account_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                    <select
                      required
                      value={purchaseForm.category_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {expenseCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseMutation.isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {purchaseMutation.isPending ? 'Processing...' : 'Confirm Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {isAdvanceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Record Advance: {activeItem?.name}</h3>
              <button onClick={() => setIsAdvanceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Received Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Amount received"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Destination Account</label>
                <select
                  required
                  value={advanceForm.account_id}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Income Category</label>
                <select
                  required
                  value={advanceForm.category_id}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {incomeCategories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advanceMutation.isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {advanceMutation.isPending ? 'Saving...' : 'Record Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
