import React, { useState } from 'react';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { MedhaApiService } from '../../services/api';
import { Search, Download, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ClassesViewProps {
  attendance: AttendanceRecord[];
  onRefresh: () => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({ attendance, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('All');

  const filtered = attendance.filter((a) => {
    const matchesBatch = batchFilter === 'All' || a.batch === batchFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      a.name.toLowerCase().includes(term) ||
      a.memberId.toLowerCase().includes(term);
    return matchesBatch && matchesSearch;
  });

  const handleCellChange = (
    memberId: string,
    field: keyof AttendanceRecord,
    status: AttendanceStatus
  ) => {
    MedhaApiService.updateAttendanceCell(memberId, field, status);
    onRefresh();
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Punctual':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Late':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Absent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-400 border-gray-200';
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
            placeholder="Search student or Member ID..."
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
            onClick={() => MedhaApiService.exportCsv(filtered, 'Medha_Attendance_Tracker.csv')}
            className="p-2 border border-[#e5e7eb] rounded-xl hover:bg-[#f7f6fb] text-[#1e1b4b] transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Attendance Matrix Table */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Group header */}
              <tr className="bg-[#ede9fe] text-[#5b21b6] border-b border-[#ddd6fe] text-[11px] font-bold">
                <th colSpan={3} className="py-2 px-3 border-r border-[#ddd6fe] text-center">Student Identity</th>
                <th colSpan={4} className="py-2 px-3 border-r border-[#ddd6fe] text-center">Class Attendance &amp; Feedback</th>
                <th colSpan={3} className="py-2 px-3 border-r border-[#ddd6fe] text-center">Workshop &amp; Review</th>
                <th colSpan={5} className="py-2 px-3 text-center">Attendance Summary</th>
              </tr>
              <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3 border-r border-[#ece9f4]">Batch</th>

                <th className="py-2.5 px-2 text-center">Class 1</th>
                <th className="py-2.5 px-2 text-center">Class 2</th>
                <th className="py-2.5 px-2 text-center">Feedback 1</th>
                <th className="py-2.5 px-2 text-center border-r border-[#ece9f4]">Feedback 2</th>

                <th className="py-2.5 px-2 text-center">Workshop Att.</th>
                <th className="py-2.5 px-2 text-center">Workshop Cls 1</th>
                <th className="py-2.5 px-2 text-center border-r border-[#ece9f4]">Exam Review 1</th>

                <th className="py-2.5 px-2 text-center text-emerald-700">Punctual</th>
                <th className="py-2.5 px-2 text-center text-amber-700">Late</th>
                <th className="py-2.5 px-2 text-center text-rose-700">Absent</th>
                <th className="py-2.5 px-3 text-center font-extrabold text-[#5b21b6]">Att. %</th>
                <th className="py-2.5 px-3">Remarks</th>
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

                  {/* Attendance Columns with Interactive Select */}
                  {(['class1', 'class2', 'feedback1', 'feedback2', 'workshopAttendance', 'workshopClass1', 'examReview1'] as (keyof AttendanceRecord)[]).map((col, idx) => (
                    <td
                      key={col}
                      className={`py-1.5 px-1 text-center ${idx === 3 || idx === 6 ? 'border-r border-[#ece9f4]' : ''}`}
                    >
                      <select
                        value={item[col] as string}
                        onChange={(e) => handleCellChange(item.memberId, col, e.target.value as AttendanceStatus)}
                        className={`text-[11px] font-semibold py-1 px-1.5 rounded-md border text-center cursor-pointer transition-colors ${getStatusBadge(
                          item[col] as AttendanceStatus
                        )}`}
                      >
                        <option value="Punctual">Punctual</option>
                        <option value="Late">Late</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </td>
                  ))}

                  {/* Summary Columns */}
                  <td className="py-2 px-2 text-center font-bold text-emerald-700">{item.punctualCount}</td>
                  <td className="py-2 px-2 text-center font-bold text-amber-700">{item.lateCount}</td>
                  <td className="py-2 px-2 text-center font-bold text-rose-700">{item.absentCount}</td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-extrabold text-[11px] ${
                        item.attendancePct >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.attendancePct >= 65
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.attendancePct}%
                    </span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="text-[11px] font-medium text-[#64748b]">{item.remarks}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
