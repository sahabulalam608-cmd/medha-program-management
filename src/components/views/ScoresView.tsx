import React, { useState } from 'react';
import { ScoreRecord } from '../../types';
import { MedhaApiService } from '../../services/api';
import { Search, Download, Award, FileText, Printer, X, CheckCircle2 } from 'lucide-react';

interface ScoresViewProps {
  scores: ScoreRecord[];
  onRefresh: () => void;
}

export const ScoresView: React.FC<ScoresViewProps> = ({ scores, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('All');
  const [selectedScore, setSelectedScore] = useState<ScoreRecord | null>(null);

  const filtered = scores.filter((s) => {
    const matchesBatch = batchFilter === 'All' || s.batch === batchFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      s.name.toLowerCase().includes(term) ||
      s.memberId.toLowerCase().includes(term);
    return matchesBatch && matchesSearch;
  });

  const handleScoreChange = (
    memberId: string,
    field: keyof ScoreRecord,
    val: number | string
  ) => {
    MedhaApiService.updateScore(memberId, field, val);
    onRefresh();
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
        return 'bg-purple-100 text-[#5b21b6] border-purple-200';
      case 'A':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search student or ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 p-1 bg-[#f7f6fb] rounded-xl border border-[#ece9f4]">
            {['All', 'NCM PART-1', 'NCM PART-2'].map((b) => (
              <button
                key={b}
                onClick={() => setBatchFilter(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  batchFilter === b ? 'bg-white text-[#5b21b6] shadow-xs' : 'text-[#64748b]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button
            onClick={() => MedhaApiService.exportCsv(filtered, 'Medha_Scores_100_Evaluation.csv')}
            className="p-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Evaluation Rubric Grid */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#ede9fe] text-[#5b21b6] border-b border-[#ddd6fe] text-[11px] font-bold">
                <th colSpan={3} className="py-2 px-3 border-r border-[#ddd6fe] text-center">Student</th>
                <th colSpan={7} className="py-2 px-3 border-r border-[#ddd6fe] text-center">
                  Score Components (100 Marks)
                </th>
                <th colSpan={3} className="py-2 px-3 text-center">Evaluation Outcome</th>
              </tr>
              <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3 border-r border-[#ece9f4]">Batch</th>

                <th className="py-2.5 px-2 text-center">Att. (10)</th>
                <th className="py-2.5 px-2 text-center">Assign. (20)</th>
                <th className="py-2.5 px-2 text-center">WS (20)</th>
                <th className="py-2.5 px-2 text-center">Email (5)</th>
                <th className="py-2.5 px-2 text-center">Exam (30)</th>
                <th className="py-2.5 px-2 text-center">Prof. (10)</th>
                <th className="py-2.5 px-2 text-center border-r border-[#ece9f4]">Pay. (5)</th>

                <th className="py-2.5 px-3 text-center font-extrabold text-[#5b21b6]">Total /100</th>
                <th className="py-2.5 px-2 text-center font-bold">Grade</th>
                <th className="py-2.5 px-3 text-right">Result Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0f7]">
              {filtered.map((item) => (
                <tr key={item.memberId} className="hover:bg-[#faf9fe] transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-[#5b21b6]">{item.memberId}</td>
                  <td className="py-2 px-3 font-semibold text-[#1e1b4b] whitespace-nowrap">{item.name}</td>
                  <td className="py-2 px-3 border-r border-[#ece9f4] text-[#64748b] whitespace-nowrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold">
                      {item.batch}
                    </span>
                  </td>

                  {/* Editable Mark Inputs */}
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={item.attendance10}
                      onChange={(e) => handleScoreChange(item.memberId, 'attendance10', Number(e.target.value))}
                      className="w-12 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={item.assignment20}
                      onChange={(e) => handleScoreChange(item.memberId, 'assignment20', Number(e.target.value))}
                      className="w-12 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={item.workshop20}
                      onChange={(e) => handleScoreChange(item.memberId, 'workshop20', Number(e.target.value))}
                      className="w-12 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={item.emailFeedback5}
                      onChange={(e) => handleScoreChange(item.memberId, 'emailFeedback5', Number(e.target.value))}
                      className="w-11 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={item.monthlyExam30}
                      onChange={(e) => handleScoreChange(item.memberId, 'monthlyExam30', Number(e.target.value))}
                      className="w-12 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={item.professional10}
                      onChange={(e) => handleScoreChange(item.memberId, 'professional10', Number(e.target.value))}
                      className="w-12 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center border-r border-[#ece9f4]">
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={item.paymentCompliance5}
                      onChange={(e) => handleScoreChange(item.memberId, 'paymentCompliance5', Number(e.target.value))}
                      className="w-11 text-center py-1 rounded border border-[#e5e7eb] focus:ring-1 focus:ring-[#7c3aed]"
                    />
                  </td>

                  {/* Total & Grade */}
                  <td className="py-2 px-3 text-center font-extrabold text-sm text-[#1e1b4b]">
                    {item.total100}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold border text-xs ${getGradeColor(item.grade)}`}>
                      {item.grade}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => setSelectedScore(item)}
                      className="px-2.5 py-1 rounded-lg bg-[#ede9fe] text-[#5b21b6] hover:bg-[#ddd6fe] text-[11px] font-bold transition-all inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Result Card</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Result Card Preview & Print Modal */}
      {selectedScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 px-6 bg-[#1e1b4b] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-sm">Official Academic Result Card</span>
              </div>
              <button
                onClick={() => setSelectedScore(null)}
                className="p-1 rounded-lg text-purple-200 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 overflow-y-auto space-y-6 text-[#1e1b4b] bg-white print:p-0">
              <div className="text-center border-b border-[#ece9f4] pb-5">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <img
                    src="/assets/img/medha-logo-256.png"
                    alt="Medha"
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="text-left">
                    <h2 className="text-xl font-extrabold tracking-tight">ONLINE TECH ACADEMY</h2>
                    <p className="text-xs text-[#64748b] font-semibold">Medha Professional Program · Academic Evaluation</p>
                  </div>
                </div>
                <div className="inline-block px-3 py-1 bg-purple-50 text-[#5b21b6] font-bold text-xs rounded-full border border-purple-200 mt-1">
                  Term Report: October 2026 Cycle
                </div>
              </div>

              {/* Student Metadata Box */}
              <div className="p-4 rounded-xl bg-[#fafafa] border border-[#ece9f4] grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#64748b] block">Student Full Name:</span>
                  <span className="font-bold text-sm text-[#1e1b4b]">{selectedScore.name}</span>
                </div>
                <div>
                  <span className="text-[#64748b] block">Member ID:</span>
                  <span className="font-mono font-bold text-sm text-[#5b21b6]">{selectedScore.memberId}</span>
                </div>
                <div>
                  <span className="text-[#64748b] block">Enrolled Program:</span>
                  <span className="font-semibold text-[#1e1b4b]">{selectedScore.batch}</span>
                </div>
                <div>
                  <span className="text-[#64748b] block">Final Grade Awarded:</span>
                  <span className="font-extrabold text-base text-[#5b21b6]">{selectedScore.grade}</span>
                </div>
              </div>

              {/* Marks Table */}
              <table className="w-full text-xs border border-[#e5e7eb] rounded-xl overflow-hidden">
                <thead className="bg-[#f7f6fb] text-[#334155] border-b border-[#e5e7eb]">
                  <tr>
                    <th className="py-2 px-3 text-left">Evaluation Criteria</th>
                    <th className="py-2 px-3 text-center">Maximum Marks</th>
                    <th className="py-2 px-3 text-right">Marks Obtained</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0f7]">
                  <tr>
                    <td className="py-2 px-3">Class Attendance &amp; Punctuality</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">10</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.attendance10}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Weekly Assignments &amp; Code Labs</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">20</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.assignment20}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Interactive Workshops &amp; Case Studies</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">20</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.workshop20}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Email Tasks &amp; Reflective Feedback</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">5</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.emailFeedback5}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Monthly Technical &amp; Systems Exam</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">30</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.monthlyExam30}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Professional Behavior &amp; Collaboration</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">10</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.professional10}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Payment Compliance &amp; Punctuality</td>
                    <td className="py-2 px-3 text-center font-mono text-[#64748b]">5</td>
                    <td className="py-2 px-3 text-right font-bold">{selectedScore.paymentCompliance5}</td>
                  </tr>
                  <tr className="bg-purple-50/50 font-bold text-sm">
                    <td className="py-2.5 px-3 text-[#5b21b6]">Cumulative Total (100 Marks)</td>
                    <td className="py-2.5 px-3 text-center font-mono">100</td>
                    <td className="py-2.5 px-3 text-right text-base text-[#5b21b6]">{selectedScore.total100} / 100</td>
                  </tr>
                </tbody>
              </table>

              {/* Remarks / Card Note */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 text-xs">
                <span className="font-bold text-[#5b21b6] block mb-1">Academic Advisor Remarks:</span>
                <p className="text-[#334155] leading-relaxed italic">
                  "{selectedScore.resultCardNote || 'Student has demonstrated sincere dedication and exemplary discipline throughout the month.'}"
                </p>
              </div>

              <div className="flex justify-between items-end pt-6 border-t border-[#ece9f4] text-[11px] text-[#64748b]">
                <div>
                  <p>Authorized Signature: _______________________</p>
                  <p className="font-semibold text-[#1e1b4b] mt-1">Academic Board · Medha Program</p>
                </div>
                <div className="text-right">
                  <p>Issue Date: October 29, 2026</p>
                  <p>Online Tech Academy Bangladesh</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 px-6 border-t border-[#ece9f4] bg-[#fafafa] flex items-center justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold text-[#1e1b4b] bg-white border border-[#e5e7eb] hover:bg-[#f7f6fb] rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-[#5b21b6]" />
                <span>Print Card</span>
              </button>
              <button
                onClick={() => setSelectedScore(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
