import React, { useState, useEffect } from 'react';
import { Lock, Unlock, X, KeyRound, AlertCircle } from 'lucide-react';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dialRotation, setDialRotation] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setActiveIndex(0);
      setDialRotation(0);
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitInput = (num: number) => {
    setError(false);
    // Rotate dial towards the number
    setDialRotation(prev => prev + 36);

    const next = [...digits];
    next[activeIndex] = String(num);
    setDigits(next);

    if (activeIndex < 3) {
      setActiveIndex(activeIndex + 1);
    } else {
      // Check full combination
      const entered = next.join('');
      if (entered === '2026') {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 300);
      } else {
        setError(true);
        setTimeout(() => {
          setDigits(['', '', '', '']);
          setActiveIndex(0);
        }, 800);
      }
    }
  };

  const handleBackspace = () => {
    if (activeIndex > 0 || digits[activeIndex]) {
      const next = [...digits];
      if (digits[activeIndex]) {
        next[activeIndex] = '';
      } else {
        next[activeIndex - 1] = '';
        setActiveIndex(activeIndex - 1);
      }
      setDigits(next);
      setError(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#1e1b4b] text-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-purple-900/50 relative overflow-hidden text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Header */}
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-[#6d28d9] to-[#8b5cf6] flex items-center justify-center shadow-lg border border-purple-400/30">
          <Lock className="w-7 h-7 text-white" />
        </div>

        <h3 className="text-xl font-extrabold tracking-tight">Security Vault</h3>
        <p className="text-xs text-purple-200/80 mt-1 mb-5">
          Enter the 4-digit master code <span className="font-mono text-purple-300 bg-purple-900/50 px-1 rounded">(2026)</span> to configure the Google Sheets backend.
        </p>

        {/* Combination Blocks */}
        <div className="flex justify-center gap-3 mb-6">
          {digits.map((digit, idx) => (
            <div
              key={idx}
              className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-mono font-bold border-2 transition-all ${
                error
                  ? 'border-rose-500 bg-rose-950/40 text-rose-300 animate-shake'
                  : idx === activeIndex
                  ? 'border-[#8b5cf6] bg-purple-950/60 text-white shadow-lg shadow-purple-500/20'
                  : digit
                  ? 'border-purple-600/50 bg-purple-950/40 text-purple-200'
                  : 'border-purple-900/40 bg-purple-950/20 text-purple-500'
              }`}
            >
              {digit ? '•' : ''}
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 mb-4 animate-in fade-in">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Incorrect code. Hint: 2026</span>
          </div>
        )}

        {/* Dial / Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleDigitInput(num)}
              className="h-11 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 active:scale-95 border border-purple-700/30 font-bold text-lg text-purple-100 transition-all"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-purple-900/20 hover:bg-purple-900/40 active:scale-95 border border-purple-800/30 text-xs font-semibold text-purple-300 transition-all flex items-center justify-center"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigitInput(0)}
            className="h-11 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 active:scale-95 border border-purple-700/30 font-bold text-lg text-purple-100 transition-all"
          >
            0
          </button>
          <button
            onClick={() => {
              setDigits(['2', '0', '2', '6']);
              setTimeout(() => {
                onSuccess();
                onClose();
              }, 200);
            }}
            className="h-11 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 active:scale-95 text-xs font-semibold text-white transition-all flex items-center justify-center gap-1"
            title="Auto-fill default pass 2026"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Auto</span>
          </button>
        </div>

        <div className="text-[11px] text-purple-400/80">
          Online Tech Academy · Medha Security Layer
        </div>
      </div>
    </div>
  );
};
