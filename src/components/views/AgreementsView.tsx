import React, { useState } from 'react';
import { AgreementItem } from '../../types';
import { MedhaApiService } from '../../services/api';
import { Search, Download, FileCheck, CheckCircle2, Clock, Eye, X, Printer } from 'lucide-react';

interface AgreementsViewProps {
  agreements: AgreementItem[];
  onRefresh: () => void;
}

export const AgreementsView: React.FC<AgreementsViewProps> = ({ agreements, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedAgr, setSelectedAgr] = useState<AgreementItem | null>(null);

  const filtered = agreements.filter((a) => {
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      a.name.toLowerCase().includes(term) ||
      a.memberId.toLowerCase().includes(term) ||
      a.type.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const handleToggleSign = (id: string, current: AgreementItem['status']) => {
    const next: AgreementItem['status'] = current === 'Signed' ? 'Pending Signature' : 'Signed';
    MedhaApiService.updateAgreementStatus(id, next);
    onRefresh();
  };

  const signedCount = agreements.filter(a => a.status === 'Signed').length;

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search agreement, student, ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 p-1 bg-[#f7f6fb] rounded-xl border border-[#ece9f4]">
            {['All', 'Signed', 'Pending Signature'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === s ? 'bg-white text-[#5b21b6] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => MedhaApiService.exportCsv(filtered, 'Medha_Agreements.csv')}
            className="p-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress banner */}
      <div className="p-4 px-5 bg-gradient-to-r from-[#f5f3ff] to-[#f8f7ff] rounded-2xl border border-purple-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-[#5b21b6]" />
          <span className="font-semibold text-[#1e1b4b]">
            Agreements Executed: <b className="text-[#5b21b6]">{signedCount}</b> of {agreements.length} enrolled students
          </span>
        </div>
        <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
          {Math.round((signedCount / (agreements.length || 1)) * 100)}% Compliance
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4">Agreement Document Type</th>
                <th className="py-3 px-4">Dispatch Date</th>
                <th className="py-3 px-4">Signed Timestamp</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0f7]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#faf9fe] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#1e1b4b]">{item.name}</div>
                    <div className="font-mono text-[10px] text-[#5b21b6]">{item.memberId}</div>
                  </td>
                  <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold">
                      {item.batch}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#1e1b4b]">
                    {item.type}
                  </td>
                  <td className="py-3 px-4 text-[#64748b] text-[11px] whitespace-nowrap">
                    {item.sentDate}
                  </td>
                  <td className="py-3 px-4 text-[#64748b] text-[11px] whitespace-nowrap">
                    {item.signedDate || '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === 'Signed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedAgr(item)}
                        className="p-1.5 text-[#5b21b6] hover:bg-[#ede9fe] rounded-lg transition-colors"
                        title="Preview Contract"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleSign(item.id, item.status)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.status === 'Signed'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-[#5b21b6] text-white hover:bg-[#6d28d9]'
                        }`}
                      >
                        {item.status === 'Signed' ? 'Mark Pending' : 'Mark Signed'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Preview Modal */}
      {selectedAgr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 px-6 bg-[#1e1b4b] text-white flex items-center justify-between">
              <span className="font-bold text-sm">Student Agreement &amp; Code of Conduct</span>
              <button onClick={() => setSelectedAgr(null)} className="p-1 text-purple-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#334155] leading-relaxed">
              <div className="text-center pb-4 border-b border-[#ece9f4]">
                <h3 className="font-extrabold text-base text-[#1e1b4b]">ONLINE TECH ACADEMY — MEDHA PROGRAM</h3>
                <p className="text-[11px] text-[#64748b]">{selectedAgr.type}</p>
              </div>

              <p>
                This Student Agreement &amp; Non-Disclosure Undertaking is made between <b>Online Tech Academy (OTA)</b> and student <b>{selectedAgr.name}</b> (Member ID: <code>{selectedAgr.memberId}</code>), enrolled in <b>{selectedAgr.batch}</b>.
              </p>

              <h4 className="font-bold text-[#1e1b4b]">1. Intellectual Property &amp; Course Materials</h4>
              <p>
                All lectures, code repositories, assignments, and architectural designs provided during the Medha Program remain proprietary to Online Tech Academy. The student undertakes not to distribute, copy, or redistribute resources externally.
              </p>

              <h4 className="font-bold text-[#1e1b4b]">2. Attendance &amp; Evaluation Code</h4>
              <p>
                The student agrees to maintain at least 80% attendance in scheduled live sessions, complete weekly assignments, and adhere to ethical collaboration standards.
              </p>

              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs font-semibold text-[#5b21b6]">
                <span>Status: {selectedAgr.status}</span>
                <span>Signed Date: {selectedAgr.signedDate || 'Pending Execution'}</span>
              </div>
            </div>

            <div className="p-4 px-6 border-t border-[#ece9f4] bg-[#fafafa] flex justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold text-[#1e1b4b] bg-white border border-[#e5e7eb] rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-[#5b21b6]" />
                <span>Print Agreement</span>
              </button>
              <button
                onClick={() => setSelectedAgr(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
