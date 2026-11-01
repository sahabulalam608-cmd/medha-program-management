import React, { useState } from 'react';
import { FeedbackItem, Member } from '../../types';
import { MedhaApiService } from '../../services/api';
import { Star, MessageSquareHeart, Plus, Search, ThumbsUp, X } from 'lucide-react';

interface FeedbackViewProps {
  feedback: FeedbackItem[];
  members: Member[];
  onRefresh: () => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({ feedback, members, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newFb, setNewFb] = useState({
    memberId: 'NCM-01',
    memberName: 'Israt Jahan',
    batch: 'NCM PART-1',
    sessionTitle: 'Session 05: Bengali Font Spacing & Architecture',
    date: new Date().toISOString().slice(0, 10),
    rating: 5,
    pace: 'Just Right' as const,
    takeaway: 'Comprehensive walk-through of the responsive grid.',
    suggestions: 'Great session overall!'
  });

  const filtered = feedback.filter((f) => {
    const term = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      f.memberName.toLowerCase().includes(term) ||
      f.sessionTitle.toLowerCase().includes(term) ||
      f.takeaway.toLowerCase().includes(term)
    );
  });

  const avgRating = feedback.length
    ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1)
    : '5.0';

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    MedhaApiService.addFeedback(newFb);
    setIsAddOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Search */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 flex items-center">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search feedback by student, session..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#e5e7eb] focus:ring-2 focus:ring-[#7c3aed] bg-[#fafafa]"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>Avg Satisfaction: {avgRating} / 5.0</span>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 bg-[#5b21b6] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Feedback</span>
          </button>
        </div>
      </div>

      {/* Feedback Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-5 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1e1b4b]">{item.sessionTitle}</h4>
                  <div className="text-[11px] text-[#64748b] mt-0.5">
                    By <b className="text-[#1e1b4b]">{item.memberName}</b> ({item.memberId}) · {item.batch}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-extrabold text-amber-900">{item.rating}</span>
                </div>
              </div>

              {/* Takeaway Box */}
              <div className="mt-3 p-3 bg-[#faf9fe] rounded-xl border border-[#ece9f4] text-xs">
                <span className="font-bold text-[#5b21b6] block mb-1">Key Takeaway:</span>
                <p className="text-[#334155] leading-relaxed italic">"{item.takeaway}"</p>
              </div>

              {item.suggestions && (
                <div className="mt-2 text-xs text-[#64748b]">
                  <span className="font-semibold text-[#1e1b4b]">Student Suggestion: </span>
                  <span>{item.suggestions}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#f7f6fb] flex items-center justify-between text-[11px] text-[#94a3b8]">
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#5b21b6] font-medium text-[10px]">
                Pace: {item.pace}
              </span>
              <span>{item.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Feedback Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#ece9f4] overflow-hidden">
            <div className="p-4 px-6 border-b border-[#ece9f4] flex items-center justify-between bg-[#fafafa]">
              <h3 className="font-bold text-sm text-[#1e1b4b]">Record Class Feedback</h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-lg text-[#64748b]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={newFb.memberName}
                  onChange={(e) => setNewFb({ ...newFb, memberName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Session / Class Title</label>
                <input
                  type="text"
                  required
                  value={newFb.sessionTitle}
                  onChange={(e) => setNewFb({ ...newFb, sessionTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Star Rating (1-5)</label>
                  <select
                    value={newFb.rating}
                    onChange={(e) => setNewFb({ ...newFb, rating: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] bg-white font-bold"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 - Outstanding)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 - Very Good)</option>
                    <option value={3}>⭐⭐⭐ (3 - Average)</option>
                    <option value={2}>⭐⭐ (2 - Below Average)</option>
                    <option value={1}>⭐ (1 - Needs Improvement)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Instructional Pace</label>
                  <select
                    value={newFb.pace}
                    onChange={(e) => setNewFb({ ...newFb, pace: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] bg-white"
                  >
                    <option value="Just Right">Just Right</option>
                    <option value="Too Fast">Too Fast</option>
                    <option value="Too Slow">Too Slow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Main Takeaway / Learning Point</label>
                <textarea
                  rows={2}
                  required
                  value={newFb.takeaway}
                  onChange={(e) => setNewFb({ ...newFb, takeaway: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f7f6fb] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5b21b6] hover:bg-[#6d28d9] rounded-xl shadow-xs"
                >
                  Save Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
