import React, { useState, useEffect } from 'react';
import { Calculator, Check, X, Delete } from 'lucide-react';

interface AmountCalculatorInputProps {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function AmountCalculatorInput({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  required = false,
}: AmountCalculatorInputProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [expression, setExpression] = useState<string>(String(value || ''));

  useEffect(() => {
    setExpression(String(value || ''));
  }, [value]);

  const safeEvaluate = (expr: string): string => {
    try {
      // Clean expression: replace x or X with *, remove invalid chars
      const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/.]/g, '');
      if (!sanitized) return '';
      
      // Evaluate basic arithmetic
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return String(Math.round(result * 100) / 100);
      }
    } catch {
      // Return raw input if expression is incomplete
    }
    return expr;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExpression(val);
    // If it's a simple number, update parent immediately
    if (/^\d*\.?\d*$/.test(val)) {
      onChange(val);
    }
  };

  const handleBlur = () => {
    if (expression.includes('+') || expression.includes('-') || expression.includes('*') || expression.includes('/')) {
      const evaluated = safeEvaluate(expression);
      setExpression(evaluated);
      onChange(evaluated);
    }
  };

  const handleCalcBtn = (char: string) => {
    if (char === 'C') {
      setExpression('');
      onChange('');
    } else if (char === 'DEL') {
      const next = expression.slice(0, -1);
      setExpression(next);
      onChange(safeEvaluate(next));
    } else if (char === '=') {
      const evaluated = safeEvaluate(expression);
      setExpression(evaluated);
      onChange(evaluated);
      setShowCalc(false);
    } else {
      const next = expression + char;
      setExpression(next);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <span className="absolute left-3 text-gray-500 font-medium text-sm pointer-events-none">₹</span>
        <input
          type="text"
          required={required}
          value={expression}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const evaluated = safeEvaluate(expression);
              setExpression(evaluated);
              onChange(evaluated);
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-7 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowCalc((prev) => !prev)}
          className={`absolute right-2 p-1.5 rounded-md transition-colors ${
            showCalc ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
          title="Open Amount Calculator (Add/Subtract multiple payments)"
        >
          <Calculator size={16} />
        </button>
      </div>

      {/* Popover Keypad Calculator */}
      {showCalc && (
        <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-64 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Calculator size={14} className="text-blue-600" /> Amount Calculator
            </span>
            <button onClick={() => setShowCalc(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleCalcBtn('C')}
              className="py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('DEL')}
              className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center"
            >
              <Delete size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('/')}
              className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors font-bold"
            >
              ÷
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('*')}
              className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors font-bold"
            >
              ×
            </button>

            {['7', '8', '9', '-'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleCalcBtn(k)}
                className={`py-2 rounded-lg transition-colors ${
                  k === '-' ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                }`}
              >
                {k}
              </button>
            ))}

            {['4', '5', '6', '+'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleCalcBtn(k)}
                className={`py-2 rounded-lg transition-colors ${
                  k === '+' ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                }`}
              >
                {k}
              </button>
            ))}

            {['1', '2', '3', '='].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleCalcBtn(k)}
                className={`py-2 rounded-lg transition-colors ${
                  k === '=' ? 'row-span-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center' : 'bg-gray-50 hover:bg-gray-100 text-gray-800'
                }`}
              >
                {k === '=' ? '=' : k}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleCalcBtn('0')}
              className="col-span-2 py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-lg transition-colors"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('.')}
              className="py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 rounded-lg transition-colors"
            >
              .
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
