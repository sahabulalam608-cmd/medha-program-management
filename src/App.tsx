import React, { useState, useEffect } from 'react';
import { ViewMode, Member, AttendanceRecord, ScoreRecord, PaymentItem, MailLog, SupportTicket, FileResource, AgreementItem, TaskItem, FeedbackItem } from './types';
import { MedhaApiService } from './services/api';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { LoginScreen } from './components/common/LoginScreen';
import { VaultModal } from './components/common/VaultModal';
import { BackendSettingsModal } from './components/common/BackendSettingsModal';

import { OverviewView } from './components/views/OverviewView';
import { BatchesView } from './components/views/BatchesView';
import { MembersView } from './components/views/MembersView';
import { PaymentsView } from './components/views/PaymentsView';
import { AgreementsView } from './components/views/AgreementsView';
import { ClassesView } from './components/views/ClassesView';
import { TasksView } from './components/views/TasksView';
import { FeedbackView } from './components/views/FeedbackView';
import { ScoresView } from './components/views/ScoresView';
import { EvidenceView } from './components/views/EvidenceView';
import { PayAdminView } from './components/views/PayAdminView';
import { SupportView } from './components/views/SupportView';
import { FilesView } from './components/views/FilesView';
import { MailPortalView } from './components/views/MailPortalView';

export const App: React.FC = () => {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [membersBatchFilter, setMembersBatchFilter] = useState('All');

  // App data state
  const [members, setMembers] = useState<Member[]>(() => MedhaApiService.getMembers());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => MedhaApiService.getAttendance());
  const [scores, setScores] = useState<ScoreRecord[]>(() => MedhaApiService.getScores());
  const [payments, setPayments] = useState<PaymentItem[]>(() => MedhaApiService.getPayments());
  const [agreements, setAgreements] = useState<AgreementItem[]>(() => MedhaApiService.getAgreements());
  const [tasks, setTasks] = useState<TaskItem[]>(() => MedhaApiService.getTasks());
  const [feedback, setFeedback] = useState<FeedbackItem[]>(() => MedhaApiService.getFeedback());
  const [mailLogs, setMailLogs] = useState<MailLog[]>(() => MedhaApiService.getMailLogs());
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => MedhaApiService.getSupportTickets());
  const [files, setFiles] = useState<FileResource[]>(() => MedhaApiService.getFiles());

  // Sheet connection state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isBackendSettingsOpen, setIsBackendSettingsOpen] = useState(false);

  // Refresh data from storage
  const handleRefresh = () => {
    setMembers(MedhaApiService.getMembers());
    setAttendance(MedhaApiService.getAttendance());
    setScores(MedhaApiService.getScores());
    setPayments(MedhaApiService.getPayments());
    setAgreements(MedhaApiService.getAgreements());
    setTasks(MedhaApiService.getTasks());
    setFeedback(MedhaApiService.getFeedback());
    setMailLogs(MedhaApiService.getMailLogs());
    setSupportTickets(MedhaApiService.getSupportTickets());
    setFiles(MedhaApiService.getFiles());
  };

  // Sync with Google Sheets
  const handleSync = async () => {
    setSyncStatus('syncing');
    try {
      const res = await MedhaApiService.syncFromGoogleSheets();
      setSyncStatus('synced');
      handleRefresh();
    } catch {
      setSyncStatus('error');
    }
  };

  // Global export action based on current view
  const handleExport = () => {
    switch (currentView) {
      case 'members':
        MedhaApiService.exportCsv(members, 'Medha_Members.csv');
        break;
      case 'classes':
        MedhaApiService.exportCsv(attendance, 'Medha_Attendance.csv');
        break;
      case 'scores':
        MedhaApiService.exportCsv(scores, 'Medha_Scores.csv');
        break;
      case 'payments':
      case 'payadmin':
        MedhaApiService.exportCsv(payments, 'Medha_Payments.csv');
        break;
      case 'agreements':
        MedhaApiService.exportCsv(agreements, 'Medha_Agreements.csv');
        break;
      case 'feedback':
        MedhaApiService.exportCsv(feedback, 'Medha_Feedback.csv');
        break;
      case 'support':
        MedhaApiService.exportCsv(supportTickets, 'Medha_Support_Tickets.csv');
        break;
      default:
        MedhaApiService.exportCsv(members, `Medha_${currentView}_Export.csv`);
        break;
    }
  };

  const handleNavigateToMembers = (batch: string) => {
    setMembersBatchFilter(batch);
    setCurrentView('members');
  };

  // If user is not authenticated, show branded login screen
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-[#1e1b4b] font-sans antialiased">
      {/* Sidebar navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setMembersBatchFilter('All');
          setCurrentView(view);
        }}
        mailBadgeCount={10}
        onOpenVault={() => setIsVaultOpen(true)}
        syncStatus={syncStatus}
        onSync={handleSync}
      />

      {/* Main app viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <Topbar
          currentView={currentView}
          onExport={handleExport}
          onOpenVault={() => setIsVaultOpen(true)}
          syncStatus={syncStatus}
        />

        {/* View Content Body */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {currentView === 'overview' && (
            <OverviewView
              members={members}
              attendance={attendance}
              scores={scores}
              payments={payments}
              mailLogs={mailLogs}
              onNavigate={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'batches' && (
            <BatchesView
              members={members}
              onNavigateToMembers={handleNavigateToMembers}
            />
          )}

          {currentView === 'members' && (
            <MembersView
              members={members}
              onRefresh={handleRefresh}
              initialBatchFilter={membersBatchFilter}
            />
          )}

          {currentView === 'payments' && (
            <PaymentsView
              payments={payments}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'agreements' && (
            <AgreementsView
              agreements={agreements}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'classes' && (
            <ClassesView
              attendance={attendance}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'tasks' && (
            <TasksView
              tasks={tasks}
              members={members}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'feedback' && (
            <FeedbackView
              feedback={feedback}
              members={members}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'scores' && (
            <ScoresView
              scores={scores}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'evidence' && (
            <EvidenceView
              scores={scores}
              attendance={attendance}
              members={members}
            />
          )}

          {currentView === 'payadmin' && (
            <PayAdminView
              payments={payments}
              members={members}
              scores={scores}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'support' && (
            <SupportView
              tickets={supportTickets}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'files' && (
            <FilesView
              files={files}
              onRefresh={handleRefresh}
            />
          )}

          {currentView === 'mail' && (
            <MailPortalView
              members={members}
              mailLogs={mailLogs}
              onRefresh={handleRefresh}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer className="py-4 px-6 text-center text-xs text-[#94a3b8] border-t border-[#ece9f4] bg-white">
          © 2026 Online Tech Academy · Medha Program Management · Bangladesh
        </footer>
      </div>

      {/* Security Combination Vault Modal */}
      <VaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onSuccess={() => setIsBackendSettingsOpen(true)}
      />

      {/* Backend / Google Sheets Configuration Modal */}
      <BackendSettingsModal
        isOpen={isBackendSettingsOpen}
        onClose={() => setIsBackendSettingsOpen(false)}
        onSaved={handleSync}
      />
    </div>
  );
};
