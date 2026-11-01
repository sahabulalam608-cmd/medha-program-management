import React from 'react';
import { Member, ViewMode } from '../../types';
import { Layers, Users, Calendar, ArrowRight, ExternalLink, Download, CheckCircle2 } from 'lucide-react';
import { MedhaApiService } from '../../services/api';

interface BatchesViewProps {
  members: Member[];
  onNavigateToMembers: (batchFilter: string) => void;
}

export const BatchesView: React.FC<BatchesViewProps> = ({ members, onNavigateToMembers }) => {
  const p1Members = members.filter(m => m.batch === 'NCM PART-1');
  const p2Members = members.filter(m => m.batch === 'NCM PART-2');

  const handleExportBatch = (batch: string, list: Member[]) => {
    MedhaApiService.exportCsv(list, `${batch.replace(/\s+/g, '_')}_Members.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1e1b4b]">Academic Batches &amp; Cohorts</h2>
          <p className="text-xs text-[#64748b]">NCM Part-1 and Part-2 program tracking, tab synchronization, and rosters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NCM PART-1 Card */}
        <div className="p-6 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-purple-100 text-[#5b21b6] text-xs font-bold rounded-full">
                NCM PART-1
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </span>
            </div>

            <h3 className="text-lg font-bold text-[#1e1b4b]">NCM Part 1 Tracker</h3>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
              Foundational software engineering &amp; digital skills cohort. Synchronized with live Google Sheet tabs: October Tracker, September Tracker, August Tracker, July Tracker.
            </p>

            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Enrolled</div>
                <div className="text-xl font-extrabold text-[#1e1b4b] mt-0.5">{p1Members.length}</div>
              </div>
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Active Trackers</div>
                <div className="text-xl font-extrabold text-[#1e1b4b] mt-0.5">4</div>
              </div>
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Sheet Tabs</div>
                <div className="text-xl font-extrabold text-[#1e1b4b] mt-0.5">5</div>
              </div>
            </div>

            <div className="text-xs text-[#64748b] space-y-1.5 mb-5 border-t border-[#f7f6fb] pt-3">
              <div className="flex justify-between">
                <span>Spreadsheet ID:</span>
                <span className="font-mono text-[#1e1b4b] text-[11px]">1DIcYeYPIascTRD...</span>
              </div>
              <div className="flex justify-between">
                <span>Primary Sheet Tab:</span>
                <span className="font-semibold text-[#1e1b4b]">October Tracker</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-[#ece9f4]">
            <button
              onClick={() => onNavigateToMembers('NCM PART-1')}
              className="flex-1 py-2 px-3 rounded-xl bg-[#5b21b6] text-white hover:bg-[#6d28d9] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>View Roster ({p1Members.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleExportBatch('NCM_PART_1', p1Members)}
              className="p-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NCM PART-2 Card */}
        <div className="p-6 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                NCM PART-2 / Batch-01 Master
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Connected
              </span>
            </div>

            <h3 className="text-lg font-bold text-[#1e1b4b]">Medha Batch-01 Master</h3>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
              Advanced cohort with expanded member metadata: transaction logs, address, WhatsApp, Medha login email, payment verification, and performance rubric.
            </p>

            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Enrolled</div>
                <div className="text-xl font-extrabold text-[#1e1b4b] mt-0.5">{p2Members.length}</div>
              </div>
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Master Tabs</div>
                <div className="text-xl font-extrabold text-[#1e1b4b] mt-0.5">8</div>
              </div>
              <div className="p-3 bg-[#f7f6fb] rounded-xl text-center">
                <div className="text-[11px] text-[#64748b]">Payment Reconciled</div>
                <div className="text-xl font-extrabold text-emerald-700 mt-0.5">100%</div>
              </div>
            </div>

            <div className="text-xs text-[#64748b] space-y-1.5 mb-5 border-t border-[#f7f6fb] pt-3">
              <div className="flex justify-between">
                <span>Spreadsheet ID:</span>
                <span className="font-mono text-[#1e1b4b] text-[11px]">1PZ4Ccbec-Qm5...</span>
              </div>
              <div className="flex justify-between">
                <span>Primary GID Tab:</span>
                <span className="font-semibold text-[#1e1b4b]">Master File (738811071)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-[#ece9f4]">
            <button
              onClick={() => onNavigateToMembers('NCM PART-2')}
              className="flex-1 py-2 px-3 rounded-xl bg-[#5b21b6] text-white hover:bg-[#6d28d9] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>View Roster ({p2Members.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleExportBatch('NCM_PART_2', p2Members)}
              className="p-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
