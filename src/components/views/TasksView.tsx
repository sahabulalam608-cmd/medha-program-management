import React, { useState } from 'react';
import { TaskItem, Member } from '../../types';
import { MedhaApiService } from '../../services/api';
import { ListTodo, CheckCircle2, Clock, ExternalLink, Award, Search, Edit3, X } from 'lucide-react';

interface TasksViewProps {
  tasks: TaskItem[];
  members: Member[];
  onRefresh: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, members, onRefresh }) => {
  const [selectedTask, setSelectedTask] = useState<TaskItem>(tasks[0] || null);
  const [gradingMemberId, setGradingMemberId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(18);
  const [feedbackInput, setFeedbackInput] = useState<string>('Well executed codebase.');

  const handleOpenGradeModal = (memberId: string, currentScore = 18, currentFb = '') => {
    setGradingMemberId(memberId);
    setGradeInput(currentScore);
    setFeedbackInput(currentFb || 'Good code clarity and test coverage.');
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !gradingMemberId) return;

    MedhaApiService.gradeSubmission(selectedTask.id, gradingMemberId, gradeInput, feedbackInput);
    setGradingMemberId(null);
    onRefresh();

    // refresh selected task in state
    const refreshed = MedhaApiService.getTasks().find(t => t.id === selectedTask.id);
    if (refreshed) setSelectedTask(refreshed);
  };

  return (
    <div className="space-y-6">
      {/* Header & Task Tabs */}
      <div>
        <h2 className="text-xl font-extrabold text-[#1e1b4b]">Tasks &amp; Workshop Submissions</h2>
        <p className="text-xs text-[#64748b]">Track deliverables, score weekly assignments, and audit code submissions</p>
      </div>

      {/* Task selector tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-[#ece9f4]">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => setSelectedTask(task)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all text-left border ${
              selectedTask?.id === task.id
                ? 'bg-[#5b21b6] text-white border-[#5b21b6] shadow-sm'
                : 'bg-white text-[#334155] border-[#e5e7eb] hover:bg-[#f7f6fb]'
            }`}
          >
            <div>{task.title}</div>
            <div className={`text-[10px] mt-0.5 ${selectedTask?.id === task.id ? 'text-purple-200' : 'text-[#64748b]'}`}>
              Due: {task.dueDate} · Max: {task.maxScore} marks
            </div>
          </button>
        ))}
      </div>

      {selectedTask && (
        <div className="space-y-4">
          {/* Task Info Summary */}
          <div className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#5b21b6]">
                  {selectedTask.type}
                </span>
                <h3 className="font-extrabold text-sm text-[#1e1b4b]">{selectedTask.title}</h3>
              </div>
              <p className="text-xs text-[#64748b] mt-1">
                Target: {selectedTask.batch} · Due date: {selectedTask.dueDate} · Graded: {selectedTask.gradedCount} of {selectedTask.submissions.length}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-800 font-bold border border-emerald-100">
                Graded: {selectedTask.gradedCount} / {selectedTask.submissions.length}
              </div>
            </div>
          </div>

          {/* Submissions List */}
          <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f7f6fb] text-[#64748b] border-b border-[#ece9f4] font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Submission Time</th>
                    <th className="py-3 px-4">Repository / Link</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Feedback Remarks</th>
                    <th className="py-3 px-4 text-center">Score ({selectedTask.maxScore})</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0f7]">
                  {selectedTask.submissions.map((sub) => {
                    const student = members.find(m => m.memberId === sub.memberId);
                    return (
                      <tr key={sub.memberId} className="hover:bg-[#faf9fe] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1e1b4b]">{student?.name || sub.memberId}</div>
                          <div className="font-mono text-[10px] text-[#5b21b6]">{sub.memberId}</div>
                        </td>
                        <td className="py-3 px-4 text-[#64748b] whitespace-nowrap">
                          {sub.submittedAt}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={sub.submissionLink || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#5b21b6] hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>View Repo</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'Submitted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[#64748b]">
                          {sub.feedback || '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-sm text-[#1e1b4b]">
                          {sub.score !== undefined ? `${sub.score} / ${selectedTask.maxScore}` : 'Ungraded'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenGradeModal(sub.memberId, sub.score, sub.feedback)}
                            className="px-2.5 py-1 bg-[#ede9fe] text-[#5b21b6] hover:bg-[#ddd6fe] rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Grade</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {gradingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#ece9f4] flex items-center justify-between bg-[#fafafa]">
              <h3 className="font-bold text-sm text-[#1e1b4b]">Grade Submission: {gradingMemberId}</h3>
              <button onClick={() => setGradingMemberId(null)} className="p-1 rounded-lg text-[#64748b]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Awarded Marks (out of {selectedTask.maxScore})
                </label>
                <input
                  type="number"
                  min="0"
                  max={selectedTask.maxScore}
                  required
                  value={gradeInput}
                  onChange={(e) => setGradeInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] font-bold text-base"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Instructor Review &amp; Code Feedback</label>
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGradingMemberId(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f7f6fb] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-xs"
                >
                  Save Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
