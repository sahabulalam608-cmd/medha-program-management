import React, { useState } from 'react';
import { SupportTicket } from '../../types';
import { MedhaApiService } from '../../services/api';
import { HelpCircle, Send, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react';

interface SupportViewProps {
  tickets: SupportTicket[];
  onRefresh: () => void;
}

export const SupportView: React.FC<SupportViewProps> = ({ tickets, onRefresh }) => {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket>(tickets[0] || null);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredTickets = tickets.filter(t => statusFilter === 'All' || t.status === statusFilter);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    MedhaApiService.addTicketMessage(selectedTicket.id, replyText.trim(), 'support');
    setReplyText('');
    onRefresh();

    // refresh selected ticket
    const refreshed = MedhaApiService.getSupportTickets().find(t => t.id === selectedTicket.id);
    if (refreshed) setSelectedTicket(refreshed);
  };

  const handleToggleStatus = (ticketId: string, current: SupportTicket['status']) => {
    const next: SupportTicket['status'] = current === 'Resolved' ? 'Open' : 'Resolved';
    MedhaApiService.updateTicketStatus(ticketId, next);
    onRefresh();

    const refreshed = MedhaApiService.getSupportTickets().find(t => t.id === ticketId);
    if (refreshed) setSelectedTicket(refreshed);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1e1b4b]">Student Support &amp; Inquiries</h2>
          <p className="text-xs text-[#64748b]">Manage LMS access issues, payment queries, and course inquiries</p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-[#ece9f4] shadow-xs">
          {['All', 'Open', 'In Progress', 'Resolved'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-[#5b21b6] text-white shadow-xs' : 'text-[#64748b] hover:text-[#1e1b4b]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="space-y-3 lg:col-span-1">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedTicket?.id === t.id
                  ? 'bg-purple-50/50 border-[#7c3aed] shadow-xs ring-1 ring-[#7c3aed]'
                  : 'bg-white border-[#ece9f4] hover:bg-[#fafafa]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[11px] font-bold text-[#5b21b6]">{t.ticketNo}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    t.status === 'Resolved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : t.status === 'In Progress'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <h4 className="font-bold text-xs text-[#1e1b4b] line-clamp-1">{t.subject}</h4>
              <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-2">
                <span>{t.name}</span>
                <span>{t.updatedAt}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Ticket Thread */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs p-6 flex flex-col h-[580px]">
              {/* Ticket Head */}
              <div className="pb-4 border-b border-[#ece9f4] flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#5b21b6]">{selectedTicket.ticketNo}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7f6fb] text-[#64748b]">
                      {selectedTicket.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedTicket.priority === 'High'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedTicket.priority} Priority
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-[#1e1b4b] mt-1.5">{selectedTicket.subject}</h3>
                  <p className="text-xs text-[#64748b]">
                    From: <b>{selectedTicket.name}</b> ({selectedTicket.email}) · Member ID: <code>{selectedTicket.memberId}</code>
                  </p>
                </div>

                <button
                  onClick={() => handleToggleStatus(selectedTicket.id, selectedTicket.status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedTicket.status === 'Resolved'
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  {selectedTicket.status === 'Resolved' ? 'Reopen Ticket' : 'Mark Resolved'}
                </button>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2">
                {selectedTicket.messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      m.sender === 'support' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        m.sender === 'support'
                          ? 'bg-[#5b21b6] text-white rounded-br-xs'
                          : 'bg-[#f7f6fb] text-[#1e1b4b] border border-[#ece9f4] rounded-bl-xs'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-[#94a3b8] mt-1 px-1">{m.time}</span>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="pt-4 border-t border-[#ece9f4] flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type an official support reply..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#e5e7eb] text-xs focus:ring-2 focus:ring-[#7c3aed] focus:outline-none bg-[#fafafa]"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-4 py-2.5 bg-[#5b21b6] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#ece9f4] p-8 text-center text-[#64748b] text-xs">
              Select a ticket to read and reply.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
