import React from 'react';
import { ViewMode } from '../../types';
import { Download, ChevronRight, CheckCircle, Database } from 'lucide-react';

interface TopbarProps {
  currentView: ViewMode;
  onExport: () => void;
  onOpenVault: () => void;
  syncStatus: 'synced' | 'syncing' | 'error';
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
  syncStatus
}) => {
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

        {/* Export Button matching screenshot */}
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Connected to Google Sheets" />
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1e1b4b] hover:bg-[#2e1065] transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
