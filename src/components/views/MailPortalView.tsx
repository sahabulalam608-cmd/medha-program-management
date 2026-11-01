import React, { useState, useEffect } from 'react';
import { Member, MailLog } from '../../types';
import { MedhaApiService } from '../../services/api';
import { MAIL_EXAMPLE_TOP, MAIL_EXAMPLE_BOTTOM } from '../../data/mockData';
import {
  Send,
  CheckCircle2,
  Calendar,
  Clock,
  Eye,
  Paperclip,
  Save,
  FolderOpen,
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';

interface MailPortalViewProps {
  members: Member[];
  mailLogs: MailLog[];
  onRefresh: () => void;
}

export const MailPortalView: React.FC<MailPortalViewProps> = ({
  members,
  mailLogs,
  onRefresh
}) => {
  // 1. Program selector with default "-- Select Program --"
  const [selectedProgram, setSelectedProgram] = useState<string>('-- Select Program --');

  // 2. Subject and Body with live editing
  const [subject, setSubject] = useState<string>('Medha Program — Welcome & Orientation Schedule (October 2026)');
  const [body, setBody] = useState<string>(
`Dear Student,

Welcome to Medha Program Management by Online Tech Academy. Please check your assigned Member ID and ensure you have verified your medha access email.

• Live Classes: Every Saturday & Tuesday at 8:30 PM BST
• Course Materials: Accessible in the Files section
• Support: Post queries anytime in the Student Support desk

Warm regards,
OTA Academic Coordination Team
Online Tech Academy Bangladesh`
  );

  const [reasonText, setReasonText] = useState<string>('');
  const [driveFolderLink, setDriveFolderLink] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // When Program is switched, set appropriate default templates if empty
  const handleProgramChange = (prog: string) => {
    setSelectedProgram(prog);
    if (prog === 'NCM PART-1') {
      setSubject('Medha NCM Part-1: Class 02 & Assignment 01 Announcement');
    } else if (prog === 'NCM PART-2') {
      setSubject('Medha NCM Part-2: Monthly Result Card Notification & Performance Summary');
    } else if (prog === 'Others') {
      setSubject('General Announcement — Medha Cohort Update');
    }
  };

  // Recipient filtering based on program
  const cohortMembers = members.filter((m) => {
    if (selectedProgram === 'NCM PART-1') return m.batch === 'NCM PART-1';
    if (selectedProgram === 'NCM PART-2') return m.batch === 'NCM PART-2';
    return true; // All
  });

  // CRITICAL REQUIREMENT:
  // Top row: NCM- 101 ( Example ) | Md Sahabul Alam | sahabulota@gmail.com
  // Middle: Cohort members
  // Bottom row: NCM-P2-0101002 ( Example ) | Md Ahsan | howladerahsan@gmail.com
  const displayRecipients: Member[] = [
    { ...MAIL_EXAMPLE_TOP, sl: 1 },
    ...cohortMembers.map((m, i) => ({ ...m, sl: i + 2 })),
    { ...MAIL_EXAMPLE_BOTTOM, sl: cohortMembers.length + 2 }
  ];

  const allCount = displayRecipients.length;
  const sentCount = displayRecipients.length; // all sent in history

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      MedhaApiService.addMailLog({
        recipientCount: displayRecipients.length,
        recipients: displayRecipients.map((r) => r.email),
        subject,
        body,
        template: selectedProgram !== '-- Select Program --' ? selectedProgram : 'Custom Message',
        sentBy: 'Medha Academic Team',
        status: 'Delivered',
        batch: selectedProgram !== '-- Select Program --' ? selectedProgram : 'All Batches'
      });
      setIsSending(false);
      setNotification(`Broadcast sent successfully to ${displayRecipients.length} recipients (including Sahabul Alam & Ahsan)!`);
      setTimeout(() => setNotification(null), 4000);
      onRefresh();
    }, 600);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner (As in Screenshot 3) */}
      <div className="p-4 px-6 rounded-2xl bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#ea580c] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Program Mail</h1>
          <p className="text-xs text-purple-100 mt-0.5">
            Batch mail · yield 1 s · 100 per page · Gmail system
          </p>
        </div>

        {/* Program selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-purple-200">Program</span>
          <select
            value={selectedProgram}
            onChange={(e) => handleProgramChange(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-xl bg-white text-[#1e1b4b] border border-white/20 focus:ring-2 focus:ring-purple-300 shadow-sm"
          >
            <option value="-- Select Program --">-- Select Program --</option>
            <option value="NCM PART-1">NCM PART-1</option>
            <option value="NCM PART-2">NCM PART-2</option>
            <option value="Others">Others</option>
          </select>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 4 Stat Boxes (As in Screenshot 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-[#ece9f4] shadow-xs text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-[#f5f3ff] text-[#7c3aed] flex items-center justify-center font-bold text-[10px]">
            All
          </div>
          <div className="text-xl font-extrabold text-[#1e1b4b]">{allCount}</div>
          <div className="text-[10px] text-[#94a3b8]">Total recipients</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#ece9f4] shadow-xs text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
            To
          </div>
          <div className="text-xl font-extrabold text-blue-600">0</div>
          <div className="text-[10px] text-[#94a3b8]">To send queue</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#ece9f4] shadow-xs text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
            ✓
          </div>
          <div className="text-xl font-extrabold text-emerald-700">{sentCount}</div>
          <div className="text-[10px] text-[#94a3b8]">Sent (success)</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#ece9f4] shadow-xs text-center">
          <div className="w-6 h-6 mx-auto mb-1 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px]">
            ✕
          </div>
          <div className="text-xl font-extrabold text-rose-600">0</div>
          <div className="text-[10px] text-[#94a3b8]">Sent (failed)</div>
        </div>
      </div>

      {/* Side-by-Side Subject Editor & Live Real-Time Preview (As in Screenshot 3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Box: Subject and Content Inputs */}
        <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#1e1b4b]">Subject</label>
              <span className="text-[10px] text-[#7c3aed] font-medium">English / Bangla support</span>
            </div>
            <textarea
              rows={3}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Write email subject here..."
              className="w-full p-3 rounded-xl border border-[#e5e7eb] text-xs font-semibold text-[#1e1b4b] focus:ring-2 focus:ring-[#7c3aed] focus:outline-none bg-[#fafafa]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1e1b4b] block mb-1">Message Body</label>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write email body content..."
              className="w-full p-3 rounded-xl border border-[#e5e7eb] text-xs font-mono text-[#334155] leading-relaxed focus:ring-2 focus:ring-[#7c3aed] focus:outline-none bg-[#fafafa]"
            />
          </div>
        </div>

        {/* Right Box: ACTUAL REAL-TIME PREVIEW CONTAINER (As in Screenshot 3) */}
        <div className="bg-[#fafafa] rounded-2xl border border-purple-200/80 shadow-xs p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-[#ece9f4]">
            <span className="text-xs font-bold text-[#5b21b6] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview — English + Bangla real-time render</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              Instant
            </span>
          </div>

          {/* Email Preview Paper */}
          <div className="my-2 p-4 rounded-xl bg-white border border-[#ece9f4] shadow-xs space-y-3 text-xs flex-1 overflow-y-auto">
            <div className="pb-2 border-b border-[#f1f0f7]">
              <span className="text-[10px] text-[#94a3b8] block">Subject:</span>
              <div className="font-extrabold text-[#1e1b4b] text-sm mt-0.5 leading-snug">
                {subject || '(No subject provided)'}
              </div>
            </div>

            <div className="text-[11px] text-[#64748b] whitespace-pre-wrap leading-relaxed font-sans">
              {body || '(Type your message to see the formatted preview here...)'}
            </div>

            <div className="pt-3 border-t border-[#f1f0f7] text-[10px] text-[#94a3b8] flex items-center justify-between">
              <span>Online Tech Academy Bangladesh</span>
              <span>Medha Academic Operations</span>
            </div>
          </div>

          <div className="text-[10px] text-[#64748b] text-right">
            Preview updates automatically as you type.
          </div>
        </div>
      </div>

      {/* Formatting Toolbar & File Row */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs p-4 space-y-3 text-xs">
        {/* Toolbar buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#ece9f4]">
          <button className="px-2.5 py-1 rounded-md border border-[#e5e7eb] font-bold text-xs hover:bg-[#f7f6fb]">B</button>
          <button className="px-2.5 py-1 rounded-md border border-[#e5e7eb] italic text-xs hover:bg-[#f7f6fb]">I</button>
          <button className="px-2.5 py-1 rounded-md border border-[#e5e7eb] underline text-xs hover:bg-[#f7f6fb]">U</button>
          <button className="px-2.5 py-1 rounded-md border border-[#e5e7eb] text-xs hover:bg-[#f7f6fb]">Link</button>
          <div className="h-4 w-px bg-[#ece9f4] mx-1" />
          <span className="text-[11px] text-[#64748b]">Font:</span>
          <select className="px-2 py-1 rounded-md border border-[#e5e7eb] text-[11px]">
            <option>Inter / Noto Sans</option>
            <option>System Default</option>
          </select>
          <span className="text-[11px] text-[#64748b] ml-1">Size:</span>
          <select className="px-2 py-1 rounded-md border border-[#e5e7eb] text-[11px]">
            <option>Normal (14px)</option>
            <option>Medium (16px)</option>
            <option>Large (18px)</option>
          </select>
        </div>

        {/* Attachment & Drive links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Attachment File</label>
            <input
              type="file"
              className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#f5f3ff] file:text-[#5b21b6] hover:file:bg-[#ede9fe]"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#64748b] block mb-1">Attachment Folder (Drive link)</label>
            <input
              type="url"
              value={driveFolderLink}
              onChange={(e) => setDriveFolderLink(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="w-full px-3 py-1.5 rounded-xl border border-[#e5e7eb] text-xs font-mono bg-[#fafafa]"
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => alert(`Previewing email for ${displayRecipients.length} recipients.`)}
              className="px-3.5 py-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] font-semibold text-xs text-[#1e1b4b]"
            >
              All Preview
            </button>
            <button
              onClick={() => {
                localStorage.setItem('mpm.mail_draft', JSON.stringify({ subject, body }));
                alert('Draft saved locally.');
              }}
              className="px-3.5 py-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] font-semibold text-xs text-[#1e1b4b]"
            >
              Save Draft
            </button>
            <button
              onClick={() => {
                const draft = localStorage.getItem('mpm.mail_draft');
                if (draft) {
                  const p = JSON.parse(draft);
                  setSubject(p.subject || '');
                  setBody(p.body || '');
                }
              }}
              className="px-3.5 py-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] font-semibold text-xs text-[#1e1b4b]"
            >
              Load Draft
            </button>
            <button
              onClick={() => alert('Test email sent to admin console.')}
              className="px-3.5 py-2 rounded-xl border border-[#e5e7eb] hover:bg-[#f7f6fb] font-semibold text-xs text-[#1e1b4b]"
            >
              Test Send
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Sending Broadcast...' : 'Send to "To Send" list'}</span>
          </button>
        </div>
      </div>

      {/* "Reason to" Audit Box (As in Screenshot 3) */}
      <div className="p-4 bg-white rounded-2xl border border-[#ece9f4] shadow-xs space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#1e1b4b]">Reason to</span>
          <span className="text-[10px] text-[#7c3aed] font-medium">Translating to English</span>
        </div>
        <p className="text-[11px] text-[#64748b]">
          Optional explanation / what you've discussed (the language text)
        </p>
        <input
          type="text"
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="Type the reason why you are sending this email (for audit, shown only to the sender) with doc id"
          className="w-full px-3 py-2 rounded-xl border border-[#e5e7eb] text-xs bg-[#fafafa]"
        />
      </div>

      {/* Recipient Table (As in Screenshot 3 with bookends Sahabul Alam on top, Ahsan at bottom) */}
      <div className="bg-white rounded-2xl border border-[#ece9f4] shadow-xs overflow-hidden">
        <div className="p-3.5 px-4 bg-[#f7f6fb] border-b border-[#ece9f4] flex items-center justify-between text-xs">
          <span className="font-bold text-[#1e1b4b]">
            Recipients List ({displayRecipients.length} total)
          </span>
          <div className="text-[11px] text-[#64748b]">
            Top: <b>Md Sahabul Alam</b> · Bottom: <b>Md Ahsan</b> (Receipt verification bookends)
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#3b82f6] text-white font-bold text-[11px] uppercase tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">SL</th>
                <th className="py-2.5 px-3">MEMBER ID</th>
                <th className="py-2.5 px-3">NAME</th>
                <th className="py-2.5 px-3">EMAIL</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">LAST SENT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0f7]">
              {displayRecipients.map((r, idx) => {
                const isBookend = r._example;
                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isBookend
                        ? 'bg-purple-50/70 font-semibold'
                        : 'hover:bg-[#faf9fe]'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-mono text-[#64748b]">{r.sl}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#5b21b6] whitespace-nowrap">
                      {r.memberId}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#1e1b4b] whitespace-nowrap">
                      {r.name}
                      {isBookend && (
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded-md">
                          Admin Copy
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#64748b] font-mono text-[11px] whitespace-nowrap">
                      {r.email}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#059669]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Sent</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#64748b] text-[11px] whitespace-nowrap">
                      {r.sentAt || '29-Oct-2026, 03:45:14 PM'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
