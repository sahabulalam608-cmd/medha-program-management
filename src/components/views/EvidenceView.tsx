import React from 'react';
import { ScoreRecord, AttendanceRecord, Member } from '../../types';
import { FileSpreadsheet, AlertCircle, Award, CheckCircle2, TrendingUp, Users } from 'lucide-react';
import { MedhaApiService } from '../../services/api';

interface EvidenceViewProps {
  scores: ScoreRecord[];
  attendance: AttendanceRecord[];
  members: Member[];
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ scores, attendance, members }) => {
  const total = scores.length || 1;
  const passed = scores.filter(s => s.grade !== 'F').length;
  const passRate = Math.round((passed / total) * 100);
  const avgScore = Math.round(scores.reduce((acc, s) => acc + s.total100, 0) / total);

  // Top performers
  const topPerformers = [...scores].sort((a, b) => b.total100 - a.total100).slice(0, 5);

  // At-risk members (attendance < 70% or total score < 60)
  const atRiskList = scores.filter(s => {
    const att = attendance.find(a => a.memberId === s.memberId);
    return s.total100 < 60 || (att && att.attendancePct < 70);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1e1b4b]">Academic Evidence &amp; Audit Reports</h2>
        <p className="text-xs text-[#64748b]">Comprehensive cohort progression, at-risk interventions, and board certifications</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Pass Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              %
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1e1b4b]">{passRate}%</span>
            <span className="text-xs text-emerald-600 font-semibold">{passed} of {total} Students</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Cohort Mean Score</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#5b21b6] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1e1b4b]">{avgScore} / 100</span>
            <span className="text-xs text-purple-600 font-semibold">Grade A Standard</span>
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Academic Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#1e1b4b]">{atRiskList.length}</span>
            <span className="text-xs text-amber-600 font-semibold">Need Follow-up</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers Table */}
        <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-[#1e1b4b] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#5b21b6]" />
            <span>Top Performing Students</span>
          </h3>

          <div className="space-y-2.5">
            {topPerformers.map((tp, idx) => (
              <div
                key={tp.memberId}
                className="p-3 rounded-xl bg-[#fafafa] border border-[#ece9f4] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#ede9fe] text-[#5b21b6] font-bold text-[11px] flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-[#1e1b4b]">{tp.name}</div>
                    <div className="font-mono text-[10px] text-[#64748b]">{tp.memberId} · {tp.batch}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-sm text-[#5b21b6]">{tp.total100} / 100</div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    Grade {tp.grade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Academic Intervention / At-Risk List */}
        <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-[#1e1b4b] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Academic Intervention Roster</span>
          </h3>

          {atRiskList.length === 0 ? (
            <p className="text-xs text-emerald-700 p-4 bg-emerald-50 rounded-xl">
              All students currently meet or exceed attendance and evaluation thresholds!
            </p>
          ) : (
            <div className="space-y-2.5">
              {atRiskList.map((ar) => {
                const att = attendance.find(a => a.memberId === ar.memberId);
                return (
                  <div
                    key={ar.memberId}
                    className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#1e1b4b]">{ar.name}</div>
                      <div className="font-mono text-[10px] text-[#64748b]">{ar.memberId} · {ar.batch}</div>
                      <div className="text-[10px] text-amber-800 mt-1">
                        Attendance: <b>{att?.attendancePct ?? 0}%</b> · Score: <b>{ar.total100}/100</b>
                      </div>
                    </div>

                    <button
                      onClick={() => alert(`Advisory alert dispatched to ${ar.name} (${ar.memberId})`)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs transition-colors shrink-0"
                    >
                      Send Advisory
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
