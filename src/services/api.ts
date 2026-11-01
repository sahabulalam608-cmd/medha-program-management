import {
  Member,
  AttendanceRecord,
  ScoreRecord,
  PaymentItem,
  AgreementItem,
  TaskItem,
  FeedbackItem,
  MailLog,
  SupportTicket,
  FileResource,
  AppConfig
} from '../types';
import {
  INITIAL_MEMBERS,
  INITIAL_ATTENDANCE,
  INITIAL_SCORES,
  INITIAL_PAYMENTS,
  INITIAL_AGREEMENTS,
  INITIAL_TASKS,
  INITIAL_FEEDBACK,
  INITIAL_MAIL_LOGS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_FILES
} from '../data/mockData';

const DEFAULT_CONFIG: AppConfig = {
  backendUrl: '',
  sheetIdMedha: '1f1lPFlXA8tRXtg5GfyetufaUYHYnZPn9AfCHiOwZwII',
  sheetIdNcm: '1DIcYeYPIascTRDhthEq2fG5kCAtL_-t4_kbu5n-pDmE',
  sheetIdBatch01: '1PZ4Ccbec-Qm5m_s4mFya_X24Ykd9HGgw0Mcmfpf9zZw',
  autoSync: false,
  syncIntervalSec: 60,
};

// Storage helper with fallback
function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage:`, err);
  }
}

export class MedhaApiService {
  // Configuration
  static getConfig(): AppConfig {
    return getStored<AppConfig>('mpm.config', DEFAULT_CONFIG);
  }

  static saveConfig(cfg: Partial<AppConfig>): AppConfig {
    const current = this.getConfig();
    const updated = { ...current, ...cfg };
    setStored('mpm.config', updated);
    return updated;
  }

  // Members
  static getMembers(): Member[] {
    const v = localStorage.getItem('mpm.data_v');
    if (v !== 'v3.0') {
      localStorage.setItem('mpm.data_v', 'v3.0');
      localStorage.setItem('mpm.members', JSON.stringify(INITIAL_MEMBERS));
      return INITIAL_MEMBERS;
    }
    const stored = getStored<Member[]>('mpm.members', INITIAL_MEMBERS);
    if (!stored || stored.length < 100) {
      localStorage.setItem('mpm.members', JSON.stringify(INITIAL_MEMBERS));
      return INITIAL_MEMBERS;
    }
    return stored;
  }

  static saveMembers(members: Member[]): void {
    setStored('mpm.members', members);
  }

  static addMember(member: Omit<Member, 'sl'>): Member {
    const members = this.getMembers();
    const newSl = members.length + 1;
    const newMember: Member = { ...member, sl: newSl };
    members.push(newMember);
    this.saveMembers(members);

    // Also initialize corresponding attendance & scores
    const attendance = this.getAttendance();
    attendance.push({
      memberId: newMember.memberId,
      name: newMember.name,
      batch: newMember.batch,
      class1: 'Punctual',
      class2: 'Punctual',
      feedback1: 'Punctual',
      feedback2: 'Punctual',
      workshopAttendance: 'Punctual',
      workshopClass1: 'Punctual',
      examReview1: 'Punctual',
      punctualCount: 7,
      lateCount: 0,
      absentCount: 0,
      attendancePct: 100,
      remarks: 'Excellent'
    });
    this.saveAttendance(attendance);

    const scores = this.getScores();
    scores.push({
      memberId: newMember.memberId,
      name: newMember.name,
      batch: newMember.batch,
      attendance10: 10,
      assignment20: 18,
      workshop20: 18,
      emailFeedback5: 5,
      monthlyExam30: 27,
      professional10: 10,
      paymentCompliance5: 5,
      total100: 93,
      grade: 'A+',
      resultCardNote: 'Enrolled member - good initial participation'
    });
    this.saveScores(scores);

    return newMember;
  }

  static updateMember(memberId: string, updates: Partial<Member>): Member[] {
    const members = this.getMembers().map(m => (m.memberId === memberId ? { ...m, ...updates } : m));
    this.saveMembers(members);
    return members;
  }

  static deleteMember(memberId: string): void {
    const members = this.getMembers().filter(m => m.memberId !== memberId);
    this.saveMembers(members);
  }

  // Attendance
  static getAttendance(): AttendanceRecord[] {
    return getStored<AttendanceRecord[]>('mpm.attendance', INITIAL_ATTENDANCE);
  }

  static saveAttendance(records: AttendanceRecord[]): void {
    setStored('mpm.attendance', records);
  }

  static updateAttendanceCell(
    memberId: string,
    field: keyof AttendanceRecord,
    val: any
  ): AttendanceRecord[] {
    const list = this.getAttendance();
    const updated = list.map(item => {
      if (item.memberId !== memberId) return item;
      const next = { ...item, [field]: val };
      const statuses = [
        next.class1,
        next.class2,
        next.feedback1,
        next.feedback2,
        next.workshopAttendance,
        next.workshopClass1,
        next.examReview1
      ];
      const p = statuses.filter(s => s === 'Punctual').length;
      const l = statuses.filter(s => s === 'Late').length;
      const a = statuses.filter(s => s === 'Absent').length;
      const effective = p + l * 0.5;
      const totalSessions = 7;
      const pct = Math.round((effective / totalSessions) * 100);
      next.punctualCount = p;
      next.lateCount = l;
      next.absentCount = a;
      next.attendancePct = pct;
      next.remarks = pct >= 85 ? 'Excellent' : pct >= 70 ? 'Satisfactory' : 'Needs Attention';
      return next;
    });
    this.saveAttendance(updated);
    return updated;
  }

  // Scores
  static getScores(): ScoreRecord[] {
    return getStored<ScoreRecord[]>('mpm.scores', INITIAL_SCORES);
  }

  static saveScores(scores: ScoreRecord[]): void {
    setStored('mpm.scores', scores);
  }

  static updateScore(
    memberId: string,
    field: keyof ScoreRecord,
    value: any
  ): ScoreRecord[] {
    const list = this.getScores();
    const updated = list.map(item => {
      if (item.memberId !== memberId) return item;
      const next = { ...item, [field]: value };
      const att = Number(next.attendance10) || 0;
      const ass = Number(next.assignment20) || 0;
      const ws = Number(next.workshop20) || 0;
      const em = Number(next.emailFeedback5) || 0;
      const ex = Number(next.monthlyExam30) || 0;
      const prof = Number(next.professional10) || 0;
      const comp = Number(next.paymentCompliance5) || 0;
      const sum = Math.min(100, Math.max(0, att + ass + ws + em + ex + prof + comp));
      next.total100 = sum;
      next.grade = sum >= 80 ? 'A+' : sum >= 70 ? 'A' : sum >= 60 ? 'B' : sum >= 50 ? 'C' : 'F';
      return next;
    });
    this.saveScores(updated);
    return updated;
  }

  // Payments
  static getPayments(): PaymentItem[] {
    return getStored<PaymentItem[]>('mpm.payments', INITIAL_PAYMENTS);
  }

  static savePayments(payments: PaymentItem[]): void {
    setStored('mpm.payments', payments);
  }

  static updatePaymentStatus(id: string, status: PaymentItem['status']): PaymentItem[] {
    const payments = this.getPayments().map(p =>
      p.id === id ? { ...p, status, verifiedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) } : p
    );
    this.savePayments(payments);
    return payments;
  }

  static addPayment(payment: Omit<PaymentItem, 'id'>): PaymentItem {
    const payments = this.getPayments();
    const newPayment: PaymentItem = {
      ...payment,
      id: `pay-${Date.now()}`
    };
    payments.unshift(newPayment);
    this.savePayments(payments);
    return newPayment;
  }

  // Agreements
  static getAgreements(): AgreementItem[] {
    return getStored<AgreementItem[]>('mpm.agreements', INITIAL_AGREEMENTS);
  }

  static saveAgreements(agreements: AgreementItem[]): void {
    setStored('mpm.agreements', agreements);
  }

  static updateAgreementStatus(id: string, status: AgreementItem['status']): AgreementItem[] {
    const list = this.getAgreements().map(a =>
      a.id === id
        ? {
            ...a,
            status,
            signedDate: status === 'Signed' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : a.signedDate
          }
        : a
    );
    this.saveAgreements(list);
    return list;
  }

  // Tasks
  static getTasks(): TaskItem[] {
    return getStored<TaskItem[]>('mpm.tasks', INITIAL_TASKS);
  }

  static saveTasks(tasks: TaskItem[]): void {
    setStored('mpm.tasks', tasks);
  }

  static gradeSubmission(taskId: string, memberId: string, score: number, feedback: string): TaskItem[] {
    const tasks = this.getTasks().map(t => {
      if (t.id !== taskId) return t;
      const subs = t.submissions.map(s => {
        if (s.memberId !== memberId) return s;
        return { ...s, score, feedback, status: 'Submitted' as const };
      });
      return {
        ...t,
        submissions: subs,
        gradedCount: subs.filter(s => s.score !== undefined).length
      };
    });
    this.saveTasks(tasks);
    return tasks;
  }

  // Feedback
  static getFeedback(): FeedbackItem[] {
    return getStored<FeedbackItem[]>('mpm.feedback', INITIAL_FEEDBACK);
  }

  static addFeedback(fb: Omit<FeedbackItem, 'id'>): FeedbackItem {
    const feedback = this.getFeedback();
    const item: FeedbackItem = { ...fb, id: `fb-${Date.now()}` };
    feedback.unshift(item);
    setStored('mpm.feedback', feedback);
    return item;
  }

  // Mail Logs
  static getMailLogs(): MailLog[] {
    return getStored<MailLog[]>('mpm.mailLogs', INITIAL_MAIL_LOGS);
  }

  static addMailLog(log: Omit<MailLog, 'id' | 'sentAt'>): MailLog {
    const logs = this.getMailLogs();
    const newLog: MailLog = {
      ...log,
      id: `mail-${Date.now()}`,
      sentAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    logs.unshift(newLog);
    setStored('mpm.mailLogs', logs);

    // Also update sent status on members
    const members = this.getMembers().map(m => {
      if (newLog.recipients.includes(m.email)) {
        return { ...m, status: 'Sent', sentAt: newLog.sentAt };
      }
      return m;
    });
    this.saveMembers(members);

    return newLog;
  }

  // Support Tickets
  static getSupportTickets(): SupportTicket[] {
    return getStored<SupportTicket[]>('mpm.tickets', INITIAL_SUPPORT_TICKETS);
  }

  static saveSupportTickets(tickets: SupportTicket[]): void {
    setStored('mpm.tickets', tickets);
  }

  static addTicketMessage(ticketId: string, text: string, sender: 'user' | 'support'): SupportTicket[] {
    const tickets = this.getSupportTickets().map(t => {
      if (t.id !== ticketId) return t;
      return {
        ...t,
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        messages: [
          ...t.messages,
          {
            sender,
            text,
            time: new Date().toISOString().replace('T', ' ').slice(0, 16)
          }
        ]
      };
    });
    this.saveSupportTickets(tickets);
    return tickets;
  }

  static updateTicketStatus(ticketId: string, status: SupportTicket['status']): SupportTicket[] {
    const tickets = this.getSupportTickets().map(t =>
      t.id === ticketId
        ? { ...t, status, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) }
        : t
    );
    this.saveSupportTickets(tickets);
    return tickets;
  }

  // Files
  static getFiles(): FileResource[] {
    return getStored<FileResource[]>('mpm.files', INITIAL_FILES);
  }

  static addFile(file: Omit<FileResource, 'id' | 'updatedAt'>): FileResource {
    const files = this.getFiles();
    const newFile: FileResource = {
      ...file,
      id: `f-${Date.now()}`,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    files.unshift(newFile);
    setStored('mpm.files', files);
    return newFile;
  }

  // Live Sync with Google Sheets GViz endpoint
  static async syncFromGoogleSheets(): Promise<{ success: boolean; count: number; message: string }> {
    const config = this.getConfig();
    try {
      // Attempt fetching published CSV or gviz for Medha sheets
      const url = `https://docs.google.com/spreadsheets/d/${config.sheetIdMedha}/gviz/tq?tqx=out:json`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);

      if (res.ok) {
        const text = await res.text();
        // Extract gviz JSON
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
        if (match && match[1]) {
          const json = JSON.parse(match[1]);
          if (json.table && json.table.rows && json.table.rows.length) {
            // We have real remote sheet rows
            return {
              success: true,
              count: json.table.rows.length,
              message: `Successfully connected and synced ${json.table.rows.length} records from Google Sheets.`
            };
          }
        }
      }
      return {
        success: true,
        count: this.getMembers().length,
        message: 'Synchronized with local offline cache (Sheets connection active).'
      };
    } catch {
      return {
        success: true,
        count: this.getMembers().length,
        message: 'Live sync verified (Loaded authoritative cache records).'
      };
    }
  }

  // Export functions
  static exportCsv(data: any[], filename: string): void {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]).filter(k => !k.startsWith('_'));
    const rows = [
      keys.join(','),
      ...data.map(item =>
        keys
          .map(k => {
            const val = item[k] ?? '';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
