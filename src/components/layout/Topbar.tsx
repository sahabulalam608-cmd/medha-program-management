import React, { useEffect, useState } from 'react';
import { ViewMode } from '../../types';
import { Download, ChevronRight, CheckCircle, Database } from 'lucide-react';

/* ---- the Bangladesh clock (UTC+6) ---------------------------------- */
function useDhakaClock() {
  const [time, setTime] = useState('--:--:--');
  const [date, setDate] = useState('');

  useEffect(() => {
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
    const dateFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka', day: 'numeric', month: 'long', year: 'numeric',
    });
    const tick = () => {
      const now = new Date();
      setTime(timeFmt.format(now));
      setDate(dateFmt.format(now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return { time, date };
}

interface TopbarProps {
  currentView: ViewMode;
  onExport: () => void;
  onOpenVault: () => void;
  syncStatus: 'synced' | 'syncing' | 'error';
  backendOnline: boolean;
}

const VIEW_TITLES: Record<ViewMode, { title: string; subtitle: string; bn: string }> = {
  overview: { title: 'Overview', subtitle: 'Program summary & key health metrics', bn: 'সারসংক্ষেপ' },
  batches: { title: 'Batches', subtitle: 'NCM Part-1 & Part-2 cohort management', bn: 'ব্যাচ ব্যবস্থাপনা' },
  members: { title: 'Members', subtitle: 'Student directory, profiles & contact details', bn: 'শিক্ষার্থী তালিকা' },
  payments: { title: 'Payments', subtitle: 'bKash / Nagad / Bank collection logs', bn: 'পেমেন্ট ও ট্রানজ্যাকশন' },
  agreements: { title: 'Agreements', subtitle: 'Student NDAs, terms & enrollment contracts', bn: 'চুক্তি ও অঙ্গীকারনামা' },
  classes: { title: 'Classes & attendance', subtitle: 'Session matrix & attendance percentages', bn: 'ক্লাস ও উপস্থিতি' },
  tasks: { title: 'Tasks & workshops', subtitle: 'Weekly submissions & project evaluations', bn: 'টাস্ক ও ওয়ার্কশপ' },
  feedback: { title: 'Feedback', subtitle: 'Student ratings, session reflections & suggestions', bn: 'মতামত ও ফিডব্যাক' },
  scores: { title: 'Scores & results', subtitle: '100-mark evaluation matrix & result cards', bn: 'মার্কস ও ফলাফল' },
  evidence: { title: 'Evidence & reports', subtitle: 'Academic audit logs & cohort analytics', bn: 'প্রমাণ ও রিপোর্ট' },
  payadmin: { title: 'Payments admin', subtitle: 'Payment compliance & manual reconciliation', bn: 'পেমেন্ট অ্যাডমিন' },
  support: { title: 'Support', subtitle: 'Student inquiries & helpdesk ticketing', bn: 'সাপোর্ট ডেস্ক' },
  files: { title: 'Files', subtitle: 'Curriculum slides, recordings & resource links', bn: 'ফাইল ও রিসোর্স' },
  mail: { title: 'Mail portal', subtitle: 'Batch email composer & delivery logs', bn: 'মেইল পোর্টাল' }
};

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  onExport,
  onOpenVault,
  syncStatus,
  backendOnline
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { time, date } = useDhakaClock();
  const info = VIEW_TITLES[currentView] || { title: 'Portal', subtitle: '', bn: '' };

  return (
    <header className="h-[60px] bg-white border-b border-[#ece9f4] px-6 flex items-center justify-between sticky top-0 z-10 select-none">
      {/* Breadcrumbs & View Name */}
      <nav className="flex items-center gap-2 text-sm">
        <span className="text-[#64748b] font-medium">Workspace</span>
        <ChevronRight className="w-4 h-4 text-[#94a3b8]" />
        <span className="text-[#1e1b4b] font-bold">{info.title}</span>
        <span className="text-xs bg-[#f5f3ff] text-[#7c3aed] font-medium px-2 py-0.5 rounded-full border border-[#ede9fe] ml-1">
          {info.bn}
        </span>
      </nav>

      {/* Topbar Actions */}
      <div className="flex items-center gap-3">
        {/* Sync Pill */}
        <button
          onClick={onOpenVault}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-xs ${
            syncStatus === 'synced'
              ? 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0] hover:bg-[#d1fae5]'
              : syncStatus === 'syncing'
              ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a] hover:bg-[#fef3c7]'
              : 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca] hover:bg-[#fee2e2]'
          }`}
          title="Google Sheets Live Connection — Click to manage backend"
        >
          <Database className="w-3.5 h-3.5 text-current" />
          <span>Google Sheets</span>
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        </button>

        {/* Direct Download Code Button for GitHub update */}
        <a
          href="/medha-source-code.zip"
          download="medha-source-code.zip"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm ring-2 ring-purple-300 ring-offset-1"
          title="Download complete updated code zip for GitHub"
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Download Code (.zip)</span>
        </a>

        {/* Export Dropdown matching original screenshot & providing downloads */}
        <div className="relative flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full shadow-xs ${backendOnline ? 'bg-emerald-500' : 'bg-amber-400'}`}
            title={backendOnline ? 'Backend connected' : 'Backend not connected — read-only'}
          />
          <div
            className="flex flex-col items-end gap-[1px] rounded-[10px] border border-[#ece8fd] bg-[#faf9ff] px-[11px] pt-[4px] pb-[5px] min-w-[116px] select-none"
            title="Bangladesh Standard Time (UTC+6)"
          >
            <span className="text-[13px] font-extrabold leading-[1.15] text-[#1e1b4b] tabular-nums tracking-[0.01em]">
              {time}
            </span>
            <span className="text-[9px] font-bold leading-[1.2] text-[#64748b] uppercase tabular-nums tracking-[0.08em]">
              {date}
            </span>
          </div>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e1b4b] hover:bg-[#2e1065] transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-purple-100 p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-bold text-[#1e1b4b]">Export & Download Options</p>
                <p className="text-[11px] text-[#64748b]">কোড ডাউনলোড ও ডেটা এক্সপোর্ট</p>
              </div>

              <div className="py-1">
                <a
                  href="/medha-source-code.zip"
                  download="medha-source-code.zip"
                  onClick={() => setShowExportMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-purple-900 hover:bg-purple-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="font-bold block">Download Source Code (.zip)</span>
                    <span className="text-[10px] text-gray-500">GitHub-এ আপলোডের জন্য সম্পূর্ণ কোড</span>
                  </div>
                </a>

                <a
                  href="/medha-dist-build.zip"
                  download="medha-dist-build.zip"
                  onClick={() => setShowExportMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-blue-900 hover:bg-blue-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-bold block">Download Dist Build (.zip)</span>
                    <span className="text-[10px] text-gray-500">সরাসরি হোস্টিংয়ের জন্য বিল্ড ফাইল</span>
                  </div>
                </a>

                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    onExport();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-emerald-900 hover:bg-emerald-50 transition-colors"
                >
                  <Database className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold block">Export Table Data (.csv)</span>
                    <span className="text-[10px] text-gray-500">বর্তমান পেজের তথ্য CSV ফাইলে ডাউনলোড</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
