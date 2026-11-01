import React, { useState } from 'react';
import { ViewMode } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Users,
  CreditCard,
  FileCheck2,
  CalendarCheck2,
  ListTodo,
  MessageSquareHeart,
  Award,
  FileSpreadsheet,
  ShieldAlert,
  HelpCircle,
  FolderOpen,
  Mail,
  LogOut,
  MoreVertical,
  CheckCircle2,
  RefreshCw,
  Sliders
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  mailBadgeCount?: number;
  onOpenVault: () => void;
  syncStatus: 'synced' | 'syncing' | 'error';
  onSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  mailBadgeCount = 3,
  onOpenVault,
  syncStatus,
  onSync
}) => {
  const { user, logout, switchUser } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems: { id: ViewMode; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { id: 'batches', label: 'Batches', icon: <Layers className="w-[18px] h-[18px]" /> },
    { id: 'members', label: 'Members', icon: <Users className="w-[18px] h-[18px]" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-[18px] h-[18px]" /> },
    { id: 'agreements', label: 'Agreements', icon: <FileCheck2 className="w-[18px] h-[18px]" /> },
    { id: 'classes', label: 'Classes & attendance', icon: <CalendarCheck2 className="w-[18px] h-[18px]" /> },
    { id: 'tasks', label: 'Tasks & workshops', icon: <ListTodo className="w-[18px] h-[18px]" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquareHeart className="w-[18px] h-[18px]" /> },
    { id: 'scores', label: 'Scores & results', icon: <Award className="w-[18px] h-[18px]" /> },
    { id: 'evidence', label: 'Evidence & reports', icon: <FileSpreadsheet className="w-[18px] h-[18px]" /> },
    { id: 'payadmin', label: 'Payments admin', icon: <ShieldAlert className="w-[18px] h-[18px]" /> },
    { id: 'support', label: 'Support', icon: <HelpCircle className="w-[18px] h-[18px]" /> },
    { id: 'files', label: 'Files', icon: <FolderOpen className="w-[18px] h-[18px]" /> },
    { id: 'mail', label: 'Mail portal', icon: <Mail className="w-[18px] h-[18px]" />, badge: mailBadgeCount }
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#ece9f4] flex flex-col h-screen sticky top-0 shrink-0 z-20 select-none">
      {/* Brand Header */}
      <div className="p-4 px-5 border-b border-[#ece9f4]">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] text-white font-extrabold text-xl shrink-0">
            <img
              src="/assets/img/medha-logo-256.png"
              alt="Medha"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="absolute">M</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-[16px] text-[#1e1b4b] tracking-tight">Medha</span>
            <span className="text-[10px] font-bold text-[#64748b] tracking-wider uppercase">PROGRAM PORTAL</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5 scrollbar-thin">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition-all text-left ${
                isActive
                  ? 'bg-[#ede9fe] text-[#5b21b6] font-bold shadow-xs'
                  : 'text-[#334155] font-medium hover:bg-[#f7f6fb] hover:text-[#1e1b4b]'
              }`}
            >
              <span className={`shrink-0 ${isActive ? 'text-[#5b21b6]' : 'text-[#64748b]'}`}>{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-[#5b21b6] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-5 text-center leading-none">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer & Account */}
      <div className="p-3 border-t border-[#ece9f4] bg-white space-y-2">
        {/* Sync card */}
        <div className="p-2.5 bg-[#f5f3ff] rounded-xl border border-[#ede9fe] text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-ping'
                    : syncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold text-[#1e1b4b]">Sheets Connected</span>
            </div>
            <button
              onClick={onSync}
              title="Sync now"
              className="p-1 hover:bg-[#ede9fe] rounded text-[#5b21b6] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#64748b]">
            <span>Auto-sync enabled</span>
            <button
              onClick={onOpenVault}
              className="text-[#7c3aed] hover:underline font-medium flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" /> Config
            </button>
          </div>
        </div>

        {/* User workspace info */}
        <div className="relative pt-1">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[#f7f6fb] transition-colors">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src="/assets/img/ota-logo-600.png"
                alt="Online Tech Academy"
                className="h-6 w-auto object-contain shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#1e1b4b] truncate">{user?.name || 'OTA Team'}</span>
                <span className="text-[10px] text-[#64748b] truncate">@{user?.username || 'ota'}</span>
              </div>
            </div>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1.5 hover:bg-[#ece9f4] rounded-md text-[#64748b] transition-colors"
              title="Account options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* User popup dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-xl shadow-xl border border-[#ece9f4] p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-2 py-1.5 border-b border-[#ece9f4] mb-1">
                <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Switch Account</div>
              </div>
              <button
                onClick={() => {
                  switchUser('admin');
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between hover:bg-[#f7f6fb] ${
                  user?.username === 'admin' ? 'font-bold text-[#5b21b6]' : 'text-[#334155]'
                }`}
              >
                <span>Medha Admin (admin)</span>
                {user?.username === 'admin' && <CheckCircle2 className="w-3.5 h-3.5 text-[#5b21b6]" />}
              </button>
              <button
                onClick={() => {
                  switchUser('ota');
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between hover:bg-[#f7f6fb] ${
                  user?.username === 'ota' ? 'font-bold text-[#5b21b6]' : 'text-[#334155]'
                }`}
              >
                <span>OTA Team (ota)</span>
                {user?.username === 'ota' && <CheckCircle2 className="w-3.5 h-3.5 text-[#5b21b6]" />}
              </button>
              <div className="border-t border-[#ece9f4] my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
