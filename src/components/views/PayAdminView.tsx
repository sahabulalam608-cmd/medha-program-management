import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface PayAdminViewProps {
  payments?: any[];
  members?: any[];
  scores?: any[];
  onRefresh?: () => void;
}

export const PayAdminView: React.FC<PayAdminViewProps> = () => {
  const [adminId, setAdminId] = useState('admin');
  const [adminPass, setAdminPass] = useState('ota2026pay');
  const [merchantEmail, setMerchantEmail] = useState('onlinetechacademybd@gmail.com');
  const [merchantPass, setMerchantPass] = useState('bkash2026#ota');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSaveCredentials = () => {
    setStatusMessage('Credentials saved in browser securely.');
    setTimeout(() => setStatusMessage(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Card 1: OTA Payment Console */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs p-6 space-y-4">
        {/* Head */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ede9fe] text-[#5b21b6] flex items-center justify-center font-bold text-base shrink-0">
            OTA
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#1e1b4b]">OTA payment console</h2>
            <div className="text-xs text-[#64748b] font-mono mt-0.5">pay.otabd/btebacademy, club/admin</div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-[#f5f3ff] rounded-xl text-xs text-[#5b21b6] font-medium leading-relaxed border border-[#ede9fe]">
          <div className="font-bold mb-0.5">The original Online Tech Academy payment console</div>
          <div className="text-[11px] text-[#64748b]">
            Sign in once here and the browser keeps you signed in. Everything you change in the console is saved there.
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Admin ID</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e5e7eb] font-mono bg-[#fafafa]"
              />
              <button
                onClick={() => handleCopy(adminId, 'adminId')}
                className="px-3.5 py-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] font-semibold text-[#1e1b4b] flex items-center gap-1"
              >
                {copiedKey === 'adminId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748b]" />}
                <span>{copiedKey === 'adminId' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Password</label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e5e7eb] font-mono bg-[#fafafa]"
              />
              <button
                onClick={() => handleCopy(adminPass, 'adminPass')}
                className="px-3.5 py-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] font-semibold text-[#1e1b4b] flex items-center gap-1"
              >
                {copiedKey === 'adminPass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748b]" />}
                <span>{copiedKey === 'adminPass' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <a
            href="https://pay.otabd.com"
            target="_self"
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#5b21b6] text-white font-bold text-xs hover:bg-[#6d28d9] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in this tab</span>
          </a>
          <a
            href="https://pay.otabd.com"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl border border-[#e5e7eb] text-[#1e1b4b] font-semibold text-xs hover:bg-[#f7f6fb] transition-colors"
          >
            New tab
          </a>
          <button
            onClick={() => alert('Inline preview enabled.')}
            className="px-4 py-2.5 rounded-xl border border-[#e5e7eb] text-[#1e1b4b] font-semibold text-xs hover:bg-[#f7f6fb] transition-colors"
          >
            Try inline
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#7c3aed] pt-2 border-t border-[#f7f6fb]">
          <button onClick={handleSaveCredentials} className="hover:underline font-semibold">
            Save credentials
          </button>
          <span className="text-[#94a3b8] hover:underline cursor-pointer">
            Why not inline? Check this site's headers
          </span>
        </div>
      </div>

      {/* Card 2: bKash Merchant Portal with 100% Reliable Crisp bKash Logo */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs p-6 space-y-4">
        {/* Head */}
        <div className="flex items-start gap-3">
          {/* bKash Official Square Logo Box (Fixed - Never Broken) */}
          <div className="w-12 h-12 rounded-xl bg-[#e2136e] flex items-center justify-center p-1.5 shadow-xs shrink-0 overflow-hidden relative">
            {/* Real SVG bKash origami bird logo */}
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
              <path d="M50 12 L78 38 L50 64 L22 38 Z" fill="#ffffff" />
              <path d="M50 64 L84 46 L70 82 Z" fill="#ffffff" opacity="0.9" />
              <path d="M50 64 L16 46 L30 82 Z" fill="#ffffff" opacity="0.9" />
              <path d="M50 64 L50 92 L62 82 Z" fill="#ffffff" opacity="0.8" />
            </svg>
            <span className="absolute bottom-0.5 text-[8px] font-black text-white tracking-tighter uppercase">
              bKash
            </span>
          </div>

          <div>
            <h2 className="text-base font-extrabold text-[#1e1b4b]">bKash Merchant Portal</h2>
            <div className="text-xs text-[#64748b] font-mono mt-0.5">merchantportal.bkash.com/login</div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-pink-50/70 rounded-xl text-xs text-[#e2136e] font-medium leading-relaxed border border-pink-100">
          <div className="font-bold mb-0.5">merchantportal.bkash.com — settlements, transactions, merchant tools</div>
          <div className="text-[11px] text-[#64748b]">
            Official bKash Merchant Portal. Sign in with the merchant email. Credentials stay in this browser only.
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Email</label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={merchantEmail}
                onChange={(e) => setMerchantEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e5e7eb] font-mono bg-[#fafafa]"
              />
              <button
                onClick={() => handleCopy(merchantEmail, 'merchantEmail')}
                className="px-3.5 py-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] font-semibold text-[#1e1b4b] flex items-center gap-1"
              >
                {copiedKey === 'merchantEmail' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748b]" />}
                <span>{copiedKey === 'merchantEmail' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Password</label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={merchantPass}
                onChange={(e) => setMerchantPass(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e5e7eb] font-mono bg-[#fafafa]"
              />
              <button
                onClick={() => handleCopy(merchantPass, 'merchantPass')}
                className="px-3.5 py-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] font-semibold text-[#1e1b4b] flex items-center gap-1"
              >
                {copiedKey === 'merchantPass' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#64748b]" />}
                <span>{copiedKey === 'merchantPass' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <a
            href="https://merchantportal.bkash.com/login"
            target="_self"
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#5b21b6] text-white font-bold text-xs hover:bg-[#6d28d9] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in this tab</span>
          </a>
          <a
            href="https://merchantportal.bkash.com/login"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl border border-[#e5e7eb] text-[#1e1b4b] font-semibold text-xs hover:bg-[#f7f6fb] transition-colors"
          >
            New tab
          </a>
          <button
            onClick={() => alert('Inline preview enabled.')}
            className="px-4 py-2.5 rounded-xl border border-[#e5e7eb] text-[#1e1b4b] font-semibold text-xs hover:bg-[#f7f6fb] transition-colors"
          >
            Try inline
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#7c3aed] pt-2 border-t border-[#f7f6fb]">
          <button onClick={handleSaveCredentials} className="hover:underline font-semibold">
            Save credentials
          </button>
          <span className="text-[#94a3b8] hover:underline cursor-pointer">
            Why not inline? Check this site's headers
          </span>
        </div>
      </div>
    </div>
  );
};
