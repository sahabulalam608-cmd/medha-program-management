export type ViewMode =
  | 'overview'
  | 'batches'
  | 'members'
  | 'payments'
  | 'agreements'
  | 'classes'
  | 'tasks'
  | 'feedback'
  | 'scores'
  | 'evidence'
  | 'payadmin'
  | 'support'
  | 'files'
  | 'mail';

export type AttendanceStatus = 'Punctual' | 'Late' | 'Absent' | 'Excused' | '';

export interface Member {
  sl: string | number;
  memberId: string;
  name: string;
  email: string;
  status?: string;
  sentAt?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  facebook?: string;
  medhaEmail?: string;
  courseMail?: string;
  tranId?: string;
  plan?: string;
  team?: string;
  paymentStatus?: 'Paid' | 'Partial' | 'Pending' | 'Overdue' | string;
  amount?: string | number;
  paymentDate?: string;
  paymentChannel?: 'bKash' | 'Nagad' | 'Bank' | 'Rocket' | string;
  batch: string; // e.g. "NCM PART-1", "NCM PART-2"
  _row?: number;
  _tab?: string;
  _demo?: boolean;
  _example?: boolean;
}

export interface AttendanceRecord {
  memberId: string;
  name: string;
  batch: string;
  class1: AttendanceStatus;
  class2: AttendanceStatus;
  feedback1: AttendanceStatus;
  feedback2: AttendanceStatus;
  workshopAttendance: AttendanceStatus;
  workshopClass1: AttendanceStatus;
  examReview1: AttendanceStatus;
  punctualCount: number;
  lateCount: number;
  absentCount: number;
  attendancePct: number;
  remarks: string;
}

export interface ScoreRecord {
  memberId: string;
  name: string;
  batch: string;
  attendance10: number; // max 10
  assignment20: number; // max 20
  workshop20: number; // max 20
  emailFeedback5: number; // max 5
  monthlyExam30: number; // max 30
  professional10: number; // max 10
  paymentCompliance5: number; // max 5
  total100: number; // calculated sum
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  resultCardNote: string;
}

export interface PaymentItem {
  id: string;
  memberId: string;
  name: string;
  batch: string;
  tranId: string;
  amount: number;
  channel: 'bKash' | 'Nagad' | 'Bank' | 'Rocket' | string;
  date: string;
  status: 'Verified' | 'Pending' | 'Rejected' | 'Installment Due';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface AgreementItem {
  id: string;
  memberId: string;
  name: string;
  batch: string;
  type: string;
  sentDate: string;
  signedDate?: string;
  status: 'Signed' | 'Pending Signature' | 'Draft';
  downloadUrl?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  type: 'Task' | 'Workshop' | 'Exam';
  dueDate: string;
  batch: string;
  totalSubmissions: number;
  gradedCount: number;
  maxScore: number;
  submissions: {
    memberId: string;
    submittedAt: string;
    status: 'Submitted' | 'Late' | 'Pending' | 'Missing';
    score?: number;
    submissionLink?: string;
    feedback?: string;
  }[];
}

export interface FeedbackItem {
  id: string;
  memberId: string;
  memberName: string;
  batch: string;
  sessionTitle: string;
  date: string;
  rating: number; // 1 to 5
  pace: 'Too Fast' | 'Just Right' | 'Too Slow';
  takeaway: string;
  suggestions: string;
}

export interface MailLog {
  id: string;
  recipientCount: number;
  recipients: string[];
  subject: string;
  body: string;
  template: string;
  sentAt: string;
  sentBy: string;
  status: 'Delivered' | 'Partially Sent' | 'Failed';
  batch: string;
}

export interface SupportTicket {
  id: string;
  ticketNo: string;
  memberId: string;
  name: string;
  email: string;
  subject: string;
  category: 'Access & Login' | 'Curriculum & Video' | 'Assignment' | 'Payment' | 'General';
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  updatedAt: string;
  messages: {
    sender: 'user' | 'support';
    text: string;
    time: string;
  }[];
}

export interface FileResource {
  id: string;
  name: string;
  category: 'Curriculum' | 'Lecture Notes' | 'Recording Link' | 'Agreement Template' | 'Form';
  size: string;
  updatedAt: string;
  url: string;
  type: 'pdf' | 'doc' | 'link' | 'zip' | 'sheet';
}

export interface UserSession {
  username: string;
  name: string;
  role: 'admin' | 'staff';
  token: string;
  loggedInAt: string;
}

export interface AppConfig {
  backendUrl: string;
  sheetIdMedha: string;
  sheetIdNcm: string;
  sheetIdBatch01: string;
  autoSync: boolean;
  syncIntervalSec: number;
}
