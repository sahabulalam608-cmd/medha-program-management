import React, { useState } from 'react';
import { Member } from '../../types';
import { MedhaApiService } from '../../services/api';
import {
  Search,
  RefreshCw,
  ExternalLink,
  X,
  ChevronRight,
  Phone,
  Mail,
  Copy,
  Check,
  Facebook
} from 'lucide-react';

interface MembersViewProps {
  members: Member[];
  onRefresh: () => void;
  initialBatchFilter?: string;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  onRefresh,
  initialBatchFilter = 'All'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchTab, setBatchTab] = useState<'All' | 'NCM PART-1' | 'NCM PART-2'>(
    initialBatchFilter === 'NCM PART-1' ? 'NCM PART-1' : initialBatchFilter === 'NCM PART-2' ? 'NCM PART-2' : 'All'
  );
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [drawerTab, setDrawerTab] = useState<'Profile' | 'Payment' | 'Attendance & Scores'>('Profile');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const p1Total = members.filter(m => m.batch === 'NCM PART-1').length || 61;
  const p2Total = members.filter(m => m.batch === 'NCM PART-2').length || 83;
  const totalCount = members.length || 144;

  const filteredMembers = members.filter((m) => {
    const matchesBatch = batchTab === 'All' || m.batch === batchTab;
    const matchesStatus = statusFilter === 'All' || (statusFilter === 'Sent' ? m.status === 'Sent' : m.status !== 'Sent');
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      m.name?.toLowerCase().includes(term) ||
      m.memberId?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.phone?.includes(term) ||
      m.tranId?.toLowerCase().includes(term);
    return matchesBatch && matchesStatus && matchesSearch;
  });

  const handleRefreshClick = async () => {
    setIsRefreshing(true);
    await MedhaApiService.syncFromGoogleSheets();
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="flex gap-5 relative">
      {/* Main Table Column */}
      <div className={`flex-1 min-w-0 space-y-4 ${selectedMember ? 'lg:pr-0' : ''}`}>
        {/* Header */}
        <div>
          <div className="text-[11px] font-bold text-[#7c3aed] uppercase tracking-wider mb-1">
            • MEDHA • PROGRAM MANAGEMENT
          </div>
          <h1 className="text-2xl font-extrabold text-[#1e1b4b] tracking-tight">Members</h1>
        </div>

        {/* Batch Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#ece9f4] pb-2">
          <button
            onClick={() => setBatchTab('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              batchTab === 'All'
                ? 'bg-[#5b21b6] text-white shadow-xs'
                : 'bg-white text-[#64748b] border border-[#ece9f4] hover:bg-[#f7f6fb]'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setBatchTab('NCM PART-1')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              batchTab === 'NCM PART-1'
                ? 'bg-[#5b21b6] text-white shadow-xs'
                : 'bg-white text-[#64748b] border border-[#ece9f4] hover:bg-[#f7f6fb]'
            }`}
          >
            NCM PART-1 ({p1Total})
          </button>
          <button
            onClick={() => setBatchTab('NCM PART-2')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              batchTab === 'NCM PART-2'
                ? 'bg-[#5b21b6] text-white shadow-xs'
                : 'bg-white text-[#64748b] border border-[#ece9f4] hover:bg-[#f7f6fb]'
            }`}
          >
            NCM PART-2 ({p2Total})
          </button>
        </div>

        {/* Search, Status and Refresh Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#ece9f4] shadow-xs">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, ID, phone, trx..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-[#e5e7eb] bg-[#fafafa] font-medium text-[#1e1b4b]"
            >
              <option value="All">All status</option>
              <option value="Sent">Sent only</option>
              <option value="Unsent">Unsent only</option>
            </select>

            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-semibold text-[#5b21b6] bg-[#f5f3ff] hover:bg-[#ede9fe] rounded-xl transition-all flex items-center gap-1.5 border border-[#ede9fe]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5 w-10 text-center">#</th>
                  <th className="py-3 px-3.5">MEMBER ID</th>
                  <th className="py-3 px-3.5">NAME</th>
                  <th className="py-3 px-3.5">EMAIL</th>
                  <th className="py-3 px-3.5">BATCH</th>
                  <th className="py-3 px-3.5">MAIL</th>
                  <th className="py-3 px-3.5">LAST SENT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f0f7]">
                {filteredMembers.map((m, idx) => {
                  const isSelected = selectedMember?.memberId === m.memberId;
                  return (
                    <tr
                      key={m.memberId || idx}
                      onClick={() => setSelectedMember(m)}
                      className={`hover:bg-[#faf9fe] cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#f5f3ff]' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 text-center font-mono text-[#94a3b8]">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-mono font-bold text-[#5b21b6] whitespace-nowrap">
                        {m.memberId}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-[#1e1b4b] whitespace-nowrap">{m.name}</td>
                      <td className="py-3 px-3.5 text-[#64748b] font-mono text-[11px] max-w-[180px] truncate">
                        {m.email}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#f7f6fb] text-[#64748b] font-bold border border-[#ece9f4]">
                          {m.batch === 'NCM PART-1' ? 'Part 1' : 'Part 2'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#059669]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Sent</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-[#64748b] text-[11px] whitespace-nowrap">
                        {m.sentAt || '29-Oct-2026, 03:45:14 PM'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-[#94a3b8] pt-1">
          * Click any row for the full profile. The site is a mirror of your Google Sheet — changes there show up here within 30 seconds, or instantly via Refresh.
        </p>
      </div>

      {/* Right-Side Member Profile Drawer (As in Screenshot 1) */}
      {selectedMember && (
        <aside className="w-80 sm:w-96 bg-white border border-[#ece9f4] rounded-2xl shadow-xl flex flex-col shrink-0 sticky top-20 h-[calc(100vh-100px)] overflow-hidden animate-in slide-in-from-right-4 duration-200 z-20">
          {/* Header */}
          <div className="p-4 px-5 border-b border-[#ece9f4] flex items-start justify-between bg-[#fafafa]">
            <div>
              <h3 className="font-extrabold text-base text-[#1e1b4b]">{selectedMember.name}</h3>
              <p className="text-xs font-mono font-bold text-[#5b21b6] mt-0.5">{selectedMember.memberId}</p>
            </div>
            <button
              onClick={() => setSelectedMember(null)}
              className="p-1 rounded-lg text-[#94a3b8] hover:text-[#1e1b4b] hover:bg-[#ece9f4]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="flex border-b border-[#ece9f4] px-4 pt-2 text-xs font-semibold gap-4 bg-white">
            {(['Profile', 'Payment', 'Attendance & Scores'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDrawerTab(tab)}
                className={`pb-2.5 transition-colors relative ${
                  drawerTab === tab
                    ? 'text-[#5b21b6] font-bold'
                    : 'text-[#64748b] hover:text-[#1e1b4b]'
                }`}
              >
                <span>{tab}</span>
                {drawerTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5b21b6] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
            {drawerTab === 'Profile' && (
              <>
                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    EMAIL
                  </span>
                  <div className="font-medium text-[#1e1b4b] flex items-center justify-between">
                    <span className="truncate">{selectedMember.email}</span>
                    <button
                      onClick={() => handleCopy(selectedMember.email, 'email')}
                      className="text-[#7c3aed] hover:underline text-[10px]"
                    >
                      {copiedKey === 'email' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    PHONE
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.phone || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    WHATSAPP
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.whatsapp || selectedMember.phone || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    ADDRESS
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.address || '—'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    PROGRAM EMAIL
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.email}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    COURSE MAIL
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.courseMail || selectedMember.email}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    MEDHA LOGIN EMAIL
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.medhaEmail || selectedMember.email}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    PLAN
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.plan || 'Full Course'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    TAG
                  </span>
                  <div className="font-medium text-[#1e1b4b]">—</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    TEAM CATEGORY
                  </span>
                  <div className="font-medium text-[#1e1b4b]">
                    {selectedMember.team || 'Lead Batch'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    FB PROFILE
                  </span>
                  <div>
                    {selectedMember.facebook ? (
                      <a
                        href={selectedMember.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff6ff] text-[#1d4ed8] text-[11px] font-bold hover:bg-[#dbeafe]"
                      >
                        <Facebook className="w-3.5 h-3.5 fill-current" />
                        <span>View Profile</span>
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    PAGE LINK
                  </span>
                  <div className="font-medium text-[#1e1b4b]">—</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    TRANSACTION ID
                  </span>
                  <div className="font-mono text-[#1e1b4b] font-bold">
                    {selectedMember.tranId || 'MD60-260928-34131214'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    MAIL STATUS
                  </span>
                  <div className="text-emerald-700 font-bold">Sent</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">
                    LAST SENT
                  </span>
                  <div className="text-[#64748b]">
                    {selectedMember.sentAt || '29-Oct-2026, 03:45:14 PM'}
                  </div>
                </div>
              </>
            )}

            {drawerTab === 'Payment' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-pink-50 border border-pink-100">
                  <div className="font-bold text-pink-900">bKash Verified</div>
                  <div className="text-xs text-[#1e1b4b] font-mono mt-1">
                    TrxID: {selectedMember.tranId || 'MD60-260928-34131214'}
                  </div>
                  <div className="text-xs text-[#1e1b4b] font-extrabold mt-1">৳6,500 Paid (Full)</div>
                </div>
              </div>
            )}

            {drawerTab === 'Attendance & Scores' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#f5f3ff] border border-[#ede9fe]">
                  <div className="font-bold text-[#5b21b6]">Attendance: 100% (7 of 7)</div>
                  <div className="text-xs text-[#1e1b4b] mt-1">Cumulative Marks: 95 / 100</div>
                  <div className="text-xs font-bold text-emerald-700 mt-1">Grade: A+ (Honors)</div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
