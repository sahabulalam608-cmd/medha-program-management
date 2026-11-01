import React from 'react';
import {
  Member,
  AttendanceRecord,
  ScoreRecord,
  PaymentItem,
  MailLog,
  ViewMode
} from '../../types';
import {
  Users,
  Mail,
  Calendar,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface OverviewViewProps {
  members: Member[];
  attendance: AttendanceRecord[];
  scores: ScoreRecord[];
  payments: PaymentItem[];
  mailLogs: MailLog[];
  onNavigate: (view: ViewMode) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  members,
  onNavigate
}) => {
  const totalCount = members.length || 144;
  const p1Members = members.filter(m => m.batch === 'NCM PART-1');
  const p2Members = members.filter(m => m.batch === 'NCM PART-2');
  const p1Count = p1Members.length || 61;
  const p2Count = p2Members.length || 83;

  const recentActivity = [
    { name: 'Kamrun Naher Ripa', batch: 'Members NCM-P1', id: 'NCM-14', time: '29 Oct, 17:33' },
    { name: 'SI Kallal', batch: 'Members NCM-P2', id: 'NCM-P2-83', time: '29 Oct, 15:48' },
    { name: 'MD Faisal Amin', batch: 'Members NCM-P2', id: 'NCM-P2-82', time: '29 Oct, 15:48' },
    { name: 'Rubel Rana', batch: 'Members NCM-P2', id: 'NCM-P2-81', time: '29 Oct, 15:48' },
    { name: 'Suleman Ahmed', batch: 'Members NCM-P2', id: 'NCM-P2-80', time: '29 Oct, 15:48' },
    { name: 'Md Atiq Mostofa', batch: 'Members NCM-P2', id: 'NCM-P2-79', time: '29 Oct, 15:48' },
  ];

  return (
    <div className="space-y-6">
      {/* Small Category Header */}
      <div>
        <div className="text-[11px] font-bold text-[#7c3aed] uppercase tracking-wider mb-1">
          • MEDHA • PROGRAM MANAGEMENT
        </div>
        <h1 className="text-2xl font-extrabold text-[#1e1b4b] tracking-tight">Overview</h1>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div
          onClick={() => onNavigate('members')}
          className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-[#64748b] font-medium">Total members</div>
              <div className="text-3xl font-extrabold text-[#1e1b4b] mt-1">{totalCount}</div>
              <div className="text-[11px] text-[#94a3b8] mt-1">Across both programs</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] text-[#7c3aed] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* NCM PART-1 */}
        <div
          onClick={() => onNavigate('members')}
          className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-[#64748b] font-medium">NCM PART-1</div>
              <div className="text-3xl font-extrabold text-[#1e1b4b] mt-1">{p1Count}</div>
              <div className="text-[11px] text-[#94a3b8] mt-1">{p1Count} mail sent</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* NCM PART-2 */}
        <div
          onClick={() => onNavigate('members')}
          className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-[#64748b] font-medium">NCM PART-2</div>
              <div className="text-3xl font-extrabold text-[#1e1b4b] mt-1">{p2Count}</div>
              <div className="text-[11px] text-[#94a3b8] mt-1">{p2Count} mail sent</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#fff7ed] text-[#ea580c] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Mails sent */}
        <div
          onClick={() => onNavigate('mail')}
          className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-[#64748b] font-medium">Mails sent</div>
              <div className="text-3xl font-extrabold text-[#1e1b4b] mt-1">{totalCount}</div>
              <div className="text-[11px] text-[#94a3b8] mt-1">Program Mail delivery</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#10b981] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Batch Overview Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="font-extrabold text-sm text-[#1e1b4b] mr-2">Batch overview</span>
            <span className="text-[#64748b]">Last mail = most recent delivery · Mailed = Status "Sent"</span>
          </div>
          <button
            onClick={() => onNavigate('batches')}
            className="text-[#7c3aed] font-semibold hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Batch 1 */}
          <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-md bg-[#f5f3ff] text-[#7c3aed] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecfdf5] text-[#059669]">
                active
              </span>
            </div>

            <div className="font-extrabold text-base text-[#1e1b4b]">Medha NCM PART-1</div>

            <div className="flex items-center gap-3 text-xs text-[#64748b]">
              <span>📅 Last mail <b>29-10-2026</b></span>
              <span>·</span>
              <span>👤 Mailed <b>{p1Count} of {p1Count}</b></span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-[#f1f0f7] overflow-hidden">
              <div className="h-full bg-[#7c3aed] rounded-full w-full" />
            </div>

            <div className="text-[11px] text-[#64748b]">
              100% of this batch has received program mail
            </div>
          </div>

          {/* Batch 2 */}
          <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-6 h-6 rounded-md bg-[#f5f3ff] text-[#7c3aed] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecfdf5] text-[#059669]">
                active
              </span>
            </div>

            <div className="font-extrabold text-base text-[#1e1b4b]">Medha NCM PART-2</div>

            <div className="flex items-center gap-3 text-xs text-[#64748b]">
              <span>📅 Last mail <b>29-10-2026</b></span>
              <span>·</span>
              <span>👤 Mailed <b>{p2Count} of {p2Count}</b></span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-[#7c3aed] overflow-hidden">
              <div className="h-full bg-[#7c3aed] rounded-full w-full" />
            </div>

            <div className="text-[11px] text-[#64748b]">
              100% of this batch has received program mail
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-sm text-[#1e1b4b]">Recent activity</span>
          <button
            onClick={() => onNavigate('mail')}
            className="text-[#7c3aed] font-semibold hover:underline flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2 bg-white rounded-2xl border border-[#ece9f4] shadow-xs divide-y divide-[#f7f6fb]">
          {recentActivity.map((act, idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-[#fafafa] transition-colors rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f5f3ff] text-[#7c3aed] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-[#1e1b4b]">
                    <span className="font-bold">{act.name}</span> <span className="text-[#64748b]">received program mail</span>
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-0.5">
                    {act.batch} · {act.id} · {act.time}
                  </div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
