import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Mic, MicOff, Sparkles, X, Check, Send, Volume2,
  Wallet, Tag, Calendar, AlertCircle, ArrowRight
} from 'lucide-react';
import { transactionService, accountService, categoryService } from '../services';
import { useAuthStore } from '../stores/authStore';

interface VoiceTextLoggerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceTextLoggerModal({ isOpen, onClose }: VoiceTextLoggerModalProps) {
  const { currentWorkspace } = useAuthStore();
  const wsId = currentWorkspace?.id ?? '';
  const queryClient = useQueryClient();

  const [textInput, setTextInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const [parsedPayload, setParsedPayload] = useState<{
    type: 'EXPENSE' | 'INCOME';
    amount: string;
    description: string;
    account_id: string;
    account_name: string;
    category_id: string;
    category_name: string;
  } | null>(null);

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

  const createMutation = useMutation({
    mutationFn: (tx: any) => transactionService.create(wsId, tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', wsId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', wsId] });
      queryClient.invalidateQueries({ queryKey: ['income', wsId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', wsId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', wsId] });
      handleReset();
      onClose();
    },
  });

  // Speech Recognition Initialization
  useEffect(() => {
    const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechClass) {
      setSpeechSupported(true);
      const recog = new SpeechClass();
      recog.continuous = false;
      recog.interimResults = true;
      recog.lang = 'en-US';

      recog.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setTextInput(transcript);
        parseSentence(transcript);
      };

      recog.onend = () => {
        setIsListening(false);
      };

      setRecognition(recog);
    }
  }, [accounts, categories]);

  if (!isOpen) return null;

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setTextInput('');
      recognition.start();
      setIsListening(true);
    }
  };

  // Smart Natural Language Sentence Parser
  const parseSentence = (sentence: string) => {
    if (!sentence.trim()) {
      setParsedPayload(null);
      return;
    }

    const lower = sentence.toLowerCase();

    // 1. Transaction Type Detection
    const isIncome = /income|earned|received|salary|credited|refund|deposit/i.test(lower);
    const txType: 'EXPENSE' | 'INCOME' = isIncome ? 'INCOME' : 'EXPENSE';

    // 2. Amount Extraction
    // Matches "450", "450.50", "₹450", "450 rupees", "rs 450"
    let amount = '';
    const amtMatch = lower.match(/(?:₹|rs\.?|rupees|amount|for)?\s*(\d+(?:\.\d+)?)/i);
    if (amtMatch) {
      amount = amtMatch[1];
    }

    // 3. Account Matching
    let selectedAccount = accounts[0];
    for (const acc of accounts) {
      const accNameLower = acc.name.toLowerCase();
      if (lower.includes(accNameLower) || (acc.bank_name && lower.includes(acc.bank_name.toLowerCase()))) {
        selectedAccount = acc;
        break;
      }
    }

    // 4. Category Matching
    let selectedCategory = categories[0];
    const typeCats = categories.filter((c: any) => c.type === txType || c.type === 'BOTH');

    for (const cat of typeCats) {
      const catNameLower = cat.name.toLowerCase();
      if (lower.includes(catNameLower)) {
        selectedCategory = cat;
        break;
      }
    }

    // Keyword heuristics if no exact category match
    if (selectedCategory === categories[0]) {
      if (/fuel|petrol|diesel|station|hp|bpcl|shell/i.test(lower)) {
        const found = categories.find((c: any) => /fuel|transport/i.test(c.name));
        if (found) selectedCategory = found;
      } else if (/grocery|supermarket|d-mart|dmart|reliance|food|dinner|lunch|starbucks/i.test(lower)) {
        const found = categories.find((c: any) => /grocery|food|dining/i.test(c.name));
        if (found) selectedCategory = found;
      } else if (/salary|wages|payout|payroll/i.test(lower)) {
        const found = categories.find((c: any) => /salary/i.test(c.name));
        if (found) selectedCategory = found;
      }
    }

    // 5. Vendor / Description Extraction
    let description = sentence;
    // Clean phrase prefix e.g. "spent 450 on petrol at HP station" -> "Petrol at HP station"
    description = description
      .replace(/^(spent|paid|bought|received|earned|logged)\s+/i, '')
      .replace(/rupees|rs\.?|₹/gi, '')
      .trim();

    if (!description) {
      description = selectedCategory?.name || (txType === 'EXPENSE' ? 'Expense' : 'Income');
    }

    setParsedPayload({
      type: txType,
      amount: amount || '0',
      description,
      account_id: selectedAccount?.id || '',
      account_name: selectedAccount?.name || 'Account',
      category_id: selectedCategory?.id || '',
      category_name: selectedCategory?.name || 'Category',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextInput(val);
    parseSentence(val);
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedPayload || !parsedPayload.amount || parseFloat(parsedPayload.amount) <= 0) return;

    createMutation.mutate({
      type: parsedPayload.type,
      amount: parseFloat(parsedPayload.amount),
      account_id: parsedPayload.account_id,
      category_id: parsedPayload.category_id || undefined,
      date: new Date().toISOString().split('T')[0],
      description: parsedPayload.description,
      notes: `Logged via Voice AI: "${textInput}"`,
    });
  };

  const handleReset = () => {
    setTextInput('');
    setParsedPayload(null);
    if (isListening && recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles size={20} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Voice & Natural AI Logger</h3>
              <p className="text-[11px] text-purple-100 opacity-90">Speak or type naturally to log transactions instantly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Voice Mic Button */}
          <div className="text-center space-y-3">
            <button
              type="button"
              onClick={toggleListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all shadow-lg ${
                isListening
                  ? 'bg-red-600 text-white ring-8 ring-red-100 animate-pulse scale-110'
                  : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white hover:scale-105'
              }`}
              title={isListening ? 'Click to Stop Recording' : 'Click to Speak'}
            >
              {isListening ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            <p className="text-xs font-semibold text-gray-700">
              {isListening ? 'Listening... Speak your expense now!' : 'Tap Microphone to Speak'}
            </p>
          </div>

          {/* Natural Text Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Or Type Natural Sentence</label>
            <div className="relative">
              <input
                type="text"
                placeholder='e.g. "Spent ₹450 on petrol at HP station using SBI card"'
                value={textInput}
                onChange={handleInputChange}
                className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <Sparkles size={16} className="absolute right-3 top-3 text-purple-500" />
            </div>
            <p className="text-[11px] text-gray-400">
              Examples: <span className="italic">"Paid 1200 for groceries at D-Mart"</span> or <span className="italic">"Earned 25000 salary"</span>
            </p>
          </div>

          {/* AI Extracted Entity Cards */}
          {parsedPayload && (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-600" /> AI Entity Recognition
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  parsedPayload.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {parsedPayload.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Amount</span>
                  <span className="font-extrabold text-base text-gray-900">₹{parsedPayload.amount || '0'}</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Account</span>
                  <span className="font-bold text-gray-800 truncate block">{parsedPayload.account_name}</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Category</span>
                  <span className="font-bold text-gray-800 truncate block">{parsedPayload.category_name}</span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase block">Description</span>
                  <span className="font-medium text-gray-700 truncate block">{parsedPayload.description}</span>
                </div>
              </div>

              <button
                onClick={handleConfirmSubmit}
                disabled={createMutation.isPending || !parsedPayload.amount || parseFloat(parsedPayload.amount) <= 0}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Logging Transaction...' : '1-Tap Confirm & Log Transaction'} <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
