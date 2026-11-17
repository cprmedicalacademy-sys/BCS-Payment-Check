import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  auth,
  clearWorkspaceAccessToken,
  signInWithGoogleWorkspace,
} from '../lib/firebase';
import {
  ADMIN_PANEL_PASSCODE_HASH,
  AcademySettings,
  AdminInvite,
  AdminUser,
  AuditLogEntry,
  BatchItem,
  ExamNotice,
  ExamResult,
  GROUP_STATUSES,
  GroupStatus,
  PAYMENT_STATUSES,
  PaymentRecord,
  PaymentStatus,
  PortalSecuritySettings,
  StudentRecord,
  StudentUpdateRequest,
  VERIFICATION_STATUSES,
  VerificationStatus,
  WhatsAppGroupRecord,
} from '../types/portal';
import {
  bulkUpdateStudentsStatus,
  fetchAllAdminCollections,
  resolveCorrectionRequest,
  resolveOrActivateAdminUser,
  seedDefaultsIfNeeded,
  updateStudentStatusAndGroup,
} from '../services/portalService';
import {
  buildWhatsAppLink,
  exportStudentsToCsv,
  formatTimestamp,
  sha256Hex,
} from '../lib/crypto';
import { StatusLabel } from './ui/StatusBadge';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { StudentProfileDrawer } from './admin/StudentProfileDrawer';
import { AdminExamsTab } from './admin/AdminExamsTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { GoogleSheetSyncPanel } from './admin/GoogleSheetSyncPanel';

type AdminTab =
  | 'overview'
  | 'students'
  | 'payments'
  | 'whatsapp'
  | 'exams'
  | 'audit'
  | 'settings';

interface AdminDashboardProps {
  academySettings: AcademySettings;
  onExitToPublic: () => void;
  onSettingsChanged: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  academySettings,
  onExitToPublic,
  onSettingsChanged,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState('');
  const [checkingPasscode, setCheckingPasscode] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Collections
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [whatsappRecords, setWhatsappRecords] = useState<WhatsAppGroupRecord[]>([]);
  const [notices, setNotices] = useState<ExamNotice[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [updateRequests, setUpdateRequests] = useState<StudentUpdateRequest[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [portalSecurity, setPortalSecurity] = useState<PortalSecuritySettings | null>(null);

  // Student Filters, Sort & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterVerification, setFilterVerification] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'reg_asc'>('date_desc');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection & Drawer
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkVerStatus, setBulkVerStatus] = useState<VerificationStatus | ''>('');
  const [bulkPayStatus, setBulkPayStatus] = useState<PaymentStatus | ''>('');
  const [bulkGrpStatus, setBulkGrpStatus] = useState<GroupStatus | ''>('');
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);

  // Confirmations
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

  const loadData = async (admin: AdminUser) => {
    setLoadingData(true);
    try {
      await seedDefaultsIfNeeded(admin);
      const data = await fetchAllAdminCollections();
      setStudents(data.students);
      setBatches(data.batches);
      setPayments(data.payments);
      setWhatsappRecords(data.whatsappRecords);
      setNotices(data.notices);
      setResults(data.results);
      setAuditLogs(data.auditLogs);
      setUpdateRequests(data.updateRequests);
      setAdmins(data.admins);
      setInvites(data.invites);
      setPortalSecurity(data.portalSecurity);

      if (activeStudent) {
        const refreshed = data.students.find((s) => s.id === activeStudent.id) || null;
        setActiveStudent(refreshed);
      }
      await onSettingsChanged();
    } catch {
      setAuthError('Failed to synchronize admin workspace data.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError('');
      if (user) {
        try {
          const admin = await resolveOrActivateAdminUser(user);
          if (!admin) {
            setCurrentAdmin(null);
            setAuthError(
              `The Google account (${user.email}) is not authorized as a CPR Medical Academy staff member.`
            );
          } else {
            setCurrentAdmin(admin);
            await loadData(admin);
          }
        } catch {
          setCurrentAdmin(null);
          setAuthError('Could not verify staff permissions.');
        }
      } else {
        setCurrentAdmin(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');
    setCheckingPasscode(true);
    try {
      const digest = await sha256Hex(passcodeInput.trim());
      if (digest === ADMIN_PANEL_PASSCODE_HASH) {
        setPasscodeUnlocked(true);
        setPasscodeInput('');
      } else {
        setPasscodeError(
          'ভুল অ্যাডমিন পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন। (Incorrect admin panel password.)'
        );
      }
    } finally {
      setCheckingPasscode(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithGoogleWorkspace();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in failed. Please ensure popups are allowed.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleLockAndSignOut = async () => {
    setPasscodeUnlocked(false);
    setPasscodeInput('');
    clearWorkspaceAccessToken();
    await signOut(auth);
  };

  // Summary KPIs (exact 7 requested)
  const metrics = useMemo(() => {
    return {
      total: students.length,
      pendingVerification: students.filter(
        (s) => s.verificationStatus === 'Submitted' || s.verificationStatus === 'Under Review'
      ).length,
      paymentDue: students.filter(
        (s) => s.paymentStatus === 'Due' || s.verificationStatus === 'Payment Due'
      ).length,
      paymentVerified: students.filter(
        (s) => s.paymentStatus === 'Verified' || s.verificationStatus === 'Payment Verified'
      ).length,
      approved: students.filter(
        (s) => s.verificationStatus === 'Approved' || s.verificationStatus === 'WhatsApp Group Added'
      ).length,
      whatsappAdded: students.filter(
        (s) => s.groupStatus === 'Added' || s.verificationStatus === 'WhatsApp Group Added'
      ).length,
      rejected: students.filter((s) => s.verificationStatus === 'Rejected / Contact Office').length,
    };
  }, [students]);

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = students.filter((s) => {
      if (
        q &&
        !s.fullName.toLowerCase().includes(q) &&
        !s.bcsRegNo.toLowerCase().includes(q) &&
        !s.whatsappNumber.toLowerCase().includes(q) &&
        !s.applicationId.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filterBatch !== 'all' && s.batchName !== filterBatch) return false;
      if (filterPayment !== 'all' && s.paymentStatus !== filterPayment) return false;
      if (filterVerification !== 'all' && s.verificationStatus !== filterVerification) return false;
      if (filterGroup !== 'all' && s.groupStatus !== filterGroup) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name_asc') return a.fullName.localeCompare(b.fullName);
      if (sortBy === 'reg_asc') return a.bcsRegNo.localeCompare(b.bcsRegNo);
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return sortBy === 'date_asc' ? ta - tb : tb - ta;
    });
  }, [students, searchQuery, filterBatch, filterPayment, filterVerification, filterGroup, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize, totalPages]);

  const canModifyStudents =
    currentAdmin?.role === 'super_admin' ||
    currentAdmin?.role === 'admin' ||
    currentAdmin?.role === 'verifier';

  const toggleSelectAllPage = () => {
    const pageIds = paginatedStudents.map((s) => s.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkApply = () => {
    if (!currentAdmin || !canModifyStudents || selectedIds.length === 0) return;
    if (!bulkVerStatus && !bulkPayStatus && !bulkGrpStatus) return;
    const targets = students.filter((s) => selectedIds.includes(s.id));

    setConfirmModal({
      open: true,
      title: `Confirm Bulk Update (${targets.length} Students)`,
      description: `Apply selected updates to ${targets.length} student records? Every status transition will be logged under ${currentAdmin.email}.`,
      confirmLabel: 'Apply Bulk Update',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          await bulkUpdateStudentsStatus(
            targets,
            {
              verificationStatus: bulkVerStatus || undefined,
              paymentStatus: bulkPayStatus || undefined,
              groupStatus: bulkGrpStatus || undefined,
            },
            currentAdmin,
            portalSecurity?.portalAccessKey || ''
          );
          setSelectedIds([]);
          setBulkVerStatus('');
          setBulkPayStatus('');
          setBulkGrpStatus('');
          await loadData(currentAdmin);
        } finally {
          setActionBusy(false);
          setConfirmModal(null);
        }
      },
    });
  };

  // --- LOGIN GATE ---
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm font-medium text-slate-600">Initializing Admin Portal...</p>
      </div>
    );
  }

  if (!passcodeUnlocked || !firebaseUser || !currentAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <img
                  src={academySettings.logoUrl || '/assets/aistudio/DA8tf_9c7eeded.jpg'}
                  alt={`${academySettings.academyName} logo`}
                  className="h-11 w-auto object-contain"
                />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0B1F3A] text-white shrink-0">
                {passcodeUnlocked ? <Shield className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
            </div>
            <h1 className="font-display text-xl font-bold text-[#0B1F3A]">
              CPR Medical Academy Admin Panel
            </h1>
            <p className="text-sm text-slate-600">
              {!passcodeUnlocked
                ? 'অ্যাডমিন প্যানেলে প্রবেশ করতে অ্যাডমিন পাসওয়ার্ড প্রদান করুন। (Enter the Admin Panel password to unlock access.)'
                : 'পাসওয়ার্ড যাচাই সম্পন্ন হয়েছে। ডাটাবেস অ্যাক্সেস করতে অনুমোদিত Google অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।'}
            </p>
          </div>

          {!passcodeUnlocked ? (
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-passcode"
                  className="block text-xs font-semibold text-[#0B1F3A]"
                >
                  Admin Panel Password (অ্যাডমিন পাসওয়ার্ড)
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="admin-passcode"
                    type={showPasscode ? 'text' : 'password'}
                    required
                    autoFocus
                    value={passcodeInput}
                    onChange={(e) => {
                      setPasscodeInput(e.target.value);
                      setPasscodeError('');
                    }}
                    placeholder="••••"
                    className="block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 pr-10 font-mono text-base tracking-widest text-slate-900 focus:border-[#1D5FA7] focus:outline-none focus:ring-2 focus:ring-[#1D5FA7]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    aria-label={showPasscode ? 'Hide password' : 'Show password'}
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {passcodeError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                  {passcodeError}
                </div>
              )}

              <button
                type="submit"
                disabled={checkingPasscode}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#0B1F3A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16345C] disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                <span>{checkingPasscode ? 'Verifying...' : 'Unlock Admin Panel'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-3.5 py-2.5 text-xs font-medium text-[#0F766E]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Admin Panel Password Verified · Step 2: Staff Google Verification</span>
              </div>

              {authError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
                  {authError}
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={handleGoogleLogin}
                  className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-[#1F1F1F] shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>

                {firebaseUser && !currentAdmin && (
                  <button
                    type="button"
                    onClick={handleLockAndSignOut}
                    className="flex min-h-[40px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Sign out ({firebaseUser.email})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPasscodeUnlocked(false)}
                  className="flex min-h-[38px] w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Lock Password Screen
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onExitToPublic}
            className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Public Student Portal</span>
          </button>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminTab; label: string; Icon: any }> = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'students', label: 'Student Management', Icon: Users },
    { id: 'payments', label: 'Payment Verification', Icon: CreditCard },
    { id: 'whatsapp', label: 'WhatsApp Group', Icon: MessageSquare },
    { id: 'exams', label: 'Exam & Results', Icon: BookOpen },
    { id: 'audit', label: 'Audit Logs', Icon: ClipboardList },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  const activeNavLabel = navItems.find((i) => i.id === activeTab)?.label || 'Overview';

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-[#0B1F3A] text-slate-200 lg:flex">
        <div className="border-b border-slate-800 px-5 py-5 space-y-2.5">
          <div className="inline-flex rounded-md bg-white px-2.5 py-1.5">
            <img
              src={academySettings.logoUrl || '/assets/aistudio/DA8tf_9c7eeded.jpg'}
              alt={`${academySettings.academyName} logo`}
              className="h-10 w-auto object-contain"
            />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-white truncate">
              {academySettings.academyName}
            </p>
            <p className="mt-0.5 text-[11px] text-teal-300">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Admin navigation">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#1D5FA7] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-white truncate">{currentAdmin.displayName}</p>
            <p className="font-mono text-[11px] text-slate-400 truncate">{currentAdmin.email}</p>
            <p className="mt-1 text-[11px] text-teal-300">Role: {currentAdmin.role}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onExitToPublic}
              className="flex items-center gap-2 rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Public Website</span>
            </button>
            <button
              type="button"
              onClick={() => setPasscodeUnlocked(false)}
              className="flex items-center gap-2 rounded border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-white/10"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Lock Panel</span>
            </button>
            <button
              type="button"
              onClick={handleLockAndSignOut}
              className="flex items-center gap-2 rounded border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-[#0B1F3A]/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 flex w-64 flex-col bg-[#0B1F3A] text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <span className="font-display text-sm font-bold text-white">Admin Console</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium ${
                    activeTab === id ? 'bg-[#1D5FA7] text-white' : 'text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-slate-800 p-4 space-y-2 text-xs">
              <button
                type="button"
                onClick={onExitToPublic}
                className="flex w-full items-center gap-2 rounded border border-slate-700 px-3 py-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Public Website</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  setPasscodeUnlocked(false);
                }}
                className="flex w-full items-center gap-2 rounded border border-slate-700 px-3 py-2"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Lock Panel</span>
              </button>
              <button
                type="button"
                onClick={handleLockAndSignOut}
                className="flex w-full items-center gap-2 rounded border border-slate-700 px-3 py-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Breadcrumb Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-slate-200 p-2 text-slate-700 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-[#0B1F3A]">Admin Portal</span>
              <span>/</span>
              <span className="font-semibold text-[#1D5FA7]">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                exportStudentsToCsv(filteredStudents, `cpr-students-${new Date().toISOString().slice(0, 10)}.csv`)
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {loadingData && students.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Loading student verification records...
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* 7 Summary KPI Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: 'Total Registered Students', value: metrics.total, accent: 'text-[#0B1F3A]' },
                      { label: 'Pending Verification', value: metrics.pendingVerification, accent: 'text-[#1D5FA7]' },
                      { label: 'Payment Due', value: metrics.paymentDue, accent: 'text-amber-700' },
                      { label: 'Payment Verified', value: metrics.paymentVerified, accent: 'text-[#0F766E]' },
                      { label: 'Approved Students', value: metrics.approved, accent: 'text-[#0F766E]' },
                      { label: 'WhatsApp Group Added', value: metrics.whatsappAdded, accent: 'text-[#1D5FA7]' },
                      { label: 'Rejected Applications', value: metrics.rejected, accent: 'text-red-700' },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="rounded-lg border border-slate-200 bg-white p-5 space-y-2"
                      >
                        <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                        <p className={`font-mono text-2xl font-bold tabular-nums ${kpi.accent}`}>
                          {kpi.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Linked Google Sheet Sync */}
                  <GoogleSheetSyncPanel students={students} />

                  {/* Pending Student Correction Requests */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                          Pending Correction Requests ({updateRequests.filter((r) => r.status === 'Pending').length})
                        </h2>
                      </div>
                      {updateRequests.filter((r) => r.status === 'Pending').length === 0 ? (
                        <p className="text-xs text-slate-500">No pending student correction requests.</p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {updateRequests
                            .filter((r) => r.status === 'Pending')
                            .slice(0, 6)
                            .map((req) => (
                              <div key={req.id} className="py-3 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-[#0B1F3A]">
                                    {req.requestedFullName} ({req.bcsRegNo})
                                  </span>
                                  <span className="font-mono text-slate-500">{req.requestedWhatsapp}</span>
                                </div>
                                <p className="text-slate-600">
                                  Batch: {req.requestedBatchName} {req.note ? `· Note: ${req.note}` : ''}
                                </p>
                                {canModifyStudents && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmModal({
                                          open: true,
                                          title: 'Mark Correction Request Resolved',
                                          description: `Mark request from ${req.bcsRegNo} as Resolved? (Remember to edit the student's profile if needed.)`,
                                          onConfirm: async () => {
                                            setActionBusy(true);
                                            await resolveCorrectionRequest(req, 'Resolved', 'Reviewed by office', currentAdmin);
                                            await loadData(currentAdmin);
                                            setActionBusy(false);
                                            setConfirmModal(null);
                                          },
                                        })
                                      }
                                      className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800"
                                    >
                                      Resolve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        resolveCorrectionRequest(req, 'Dismissed', 'Dismissed by office', currentAdmin).then(() =>
                                          loadData(currentAdmin)
                                        )
                                      }
                                      className="rounded border border-slate-200 px-2.5 py-1 text-slate-600"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Audit Feed */}
                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                          Recent Audit Activity
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('audit')}
                          className="text-xs font-semibold text-[#1D5FA7] hover:underline"
                        >
                          View all
                        </button>
                      </div>
                      {auditLogs.length === 0 ? (
                        <p className="text-xs text-slate-500">No audit events recorded yet.</p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {auditLogs.slice(0, 6).map((log) => (
                            <div key={log.id} className="py-2.5 text-xs space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[#0B1F3A]">{log.action}</span>
                                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                                  {formatTimestamp(log.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-600 truncate">{log.targetLabel} · {log.details}</p>
                              <p className="text-[11px] text-slate-400">By: {log.actorEmail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STUDENT MANAGEMENT */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <GoogleSheetSyncPanel students={students} compact />

                  {/* Search & 4 Filters */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="relative md:col-span-4">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Search name, BCS Reg No, WhatsApp, or App ID..."
                          className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-[#1D5FA7] focus:outline-none"
                        />
                      </div>

                      <select
                        value={filterBatch}
                        onChange={(e) => {
                          setFilterBatch(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs md:col-span-2"
                      >
                        <option value="all">All Batches</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterPayment}
                        onChange={(e) => {
                          setFilterPayment(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs md:col-span-2"
                      >
                        <option value="all">All Payments</option>
                        {PAYMENT_STATUSES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterVerification}
                        onChange={(e) => {
                          setFilterVerification(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs md:col-span-2"
                      >
                        <option value="all">All Verification</option>
                        {VERIFICATION_STATUSES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filterGroup}
                        onChange={(e) => {
                          setFilterGroup(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs md:col-span-2"
                      >
                        <option value="all">All Group Status</option>
                        {GROUP_STATUSES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span>Sort:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          <option value="date_desc">Newest First</option>
                          <option value="date_asc">Oldest First</option>
                          <option value="name_asc">Name (A–Z)</option>
                          <option value="reg_asc">BCS Reg No</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="tabular-nums">
                          Showing {filteredStudents.length} records
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Action Bar */}
                  {selectedIds.length > 0 && canModifyStudents && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 text-xs">
                      <span className="font-semibold text-[#0B1F3A] tabular-nums">
                        {selectedIds.length} selected
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={bulkVerStatus}
                          onChange={(e) => setBulkVerStatus(e.target.value as any)}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                        >
                          <option value="">Set Verification...</option>
                          {VERIFICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bulkPayStatus}
                          onChange={(e) => setBulkPayStatus(e.target.value as any)}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                        >
                          <option value="">Set Payment...</option>
                          {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          value={bulkGrpStatus}
                          onChange={(e) => setBulkGrpStatus(e.target.value as any)}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1.5"
                        >
                          <option value="">Set Group...</option>
                          {GROUP_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkApply}
                          className="rounded-md bg-[#1D5FA7] px-3.5 py-1.5 font-semibold text-white hover:bg-[#164A84]"
                        >
                          Apply Bulk Action
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Student Table */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={
                                  paginatedStudents.length > 0 &&
                                  paginatedStudents.every((s) => selectedIds.includes(s.id))
                                }
                                onChange={toggleSelectAllPage}
                                aria-label="Select all on page"
                              />
                            </th>
                            <th className="px-3 py-3 font-semibold">Candidate & App ID</th>
                            <th className="px-3 py-3 font-semibold">BCS Reg No</th>
                            <th className="px-3 py-3 font-semibold">WhatsApp</th>
                            <th className="px-3 py-3 font-semibold">Batch</th>
                            <th className="px-3 py-3 font-semibold">Verification</th>
                            <th className="px-3 py-3 font-semibold">Payment</th>
                            <th className="px-3 py-3 font-semibold">Group</th>
                            <th className="px-3 py-3 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedStudents.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                                No students match the active search or filters.
                              </td>
                            </tr>
                          ) : (
                            paginatedStudents.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-3 py-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(s.id)}
                                    onChange={() =>
                                      setSelectedIds((prev) =>
                                        prev.includes(s.id)
                                          ? prev.filter((id) => id !== s.id)
                                          : [...prev, s.id]
                                      )
                                    }
                                    aria-label={`Select ${s.fullName}`}
                                  />
                                </td>
                                <td className="px-3 py-3">
                                  <p className="font-semibold text-[#0B1F3A]">{s.fullName}</p>
                                  <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                                    {s.applicationId}
                                  </p>
                                </td>
                                <td className="px-3 py-3 font-mono font-medium text-slate-800 tabular-nums">
                                  {s.bcsRegNo}
                                </td>
                                <td className="px-3 py-3 font-mono text-slate-700 tabular-nums">
                                  {s.whatsappNumber}
                                </td>
                                <td className="px-3 py-3 text-slate-700">{s.batchName}</td>
                                <td className="px-3 py-3">
                                  <StatusLabel status={s.verificationStatus} compact />
                                </td>
                                <td className="px-3 py-3">
                                  <StatusLabel status={s.paymentStatus} compact />
                                </td>
                                <td className="px-3 py-3">
                                  <StatusLabel status={s.groupStatus} compact />
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setActiveStudent(s)}
                                    className="rounded border border-slate-300 bg-white px-3 py-1 font-semibold text-[#1D5FA7] hover:bg-slate-50 whitespace-nowrap"
                                  >
                                    Manage
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                      <span className="tabular-nums">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYMENT VERIFICATION */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                          Manual Payment Review Queue
                        </h2>
                        <p className="text-xs text-slate-600">
                          Click any candidate to manually verify tuition payments, record due amounts, and add payment remarks.
                        </p>
                      </div>
                      <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="all">All Payment Statuses</option>
                        {PAYMENT_STATUSES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5 font-semibold">Candidate</th>
                            <th className="px-3 py-2.5 font-semibold">BCS Reg No</th>
                            <th className="px-3 py-2.5 font-semibold">Batch</th>
                            <th className="px-3 py-2.5 font-semibold">Payment Status</th>
                            <th className="px-3 py-2.5 font-semibold">Verification</th>
                            <th className="px-3 py-2.5 font-semibold text-right">Review</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students
                            .filter((s) => filterPayment === 'all' || s.paymentStatus === filterPayment)
                            .map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-medium text-[#0B1F3A]">{s.fullName}</td>
                                <td className="px-3 py-2.5 font-mono tabular-nums">{s.bcsRegNo}</td>
                                <td className="px-3 py-2.5 text-slate-600">{s.batchName}</td>
                                <td className="px-3 py-2.5">
                                  <StatusLabel status={s.paymentStatus} compact />
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusLabel status={s.verificationStatus} compact />
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setActiveStudent(s)}
                                    className="rounded border border-slate-300 px-3 py-1 font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
                                  >
                                    Verify Payment
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Payment Ledger */}
                  <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                      Payment Verification Ledger
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Student</th>
                            <th className="px-3 py-2">Transition</th>
                            <th className="px-3 py-2 text-right">Paid (BDT)</th>
                            <th className="px-3 py-2 text-right">Due (BDT)</th>
                            <th className="px-3 py-2">Remark</th>
                            <th className="px-3 py-2">Verified By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                                No manual payment records logged yet.
                              </td>
                            </tr>
                          ) : (
                            payments.map((p) => (
                              <tr key={p.id}>
                                <td className="px-3 py-2 font-mono text-slate-500 tabular-nums">
                                  {formatTimestamp(p.createdAt)}
                                </td>
                                <td className="px-3 py-2 font-medium text-[#0B1F3A]">
                                  {p.studentName} ({p.bcsRegNo})
                                </td>
                                <td className="px-3 py-2">
                                  {p.previousStatus} → <strong>{p.newStatus}</strong>
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                  {p.amountPaid}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                  {p.amountDue}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{p.referenceNote || '—'}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{p.verifiedByEmail}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WHATSAPP GROUP MANAGEMENT */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                          Manual WhatsApp Group Addition Queue
                        </h2>
                        <p className="text-xs text-slate-600">
                          Contact eligible candidates via WhatsApp and manually mark them as Added once placed into the official batch group.
                        </p>
                      </div>
                      <select
                        value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs"
                      >
                        <option value="all">All Group Statuses</option>
                        {GROUP_STATUSES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5 font-semibold">Candidate</th>
                            <th className="px-3 py-2.5 font-semibold">WhatsApp</th>
                            <th className="px-3 py-2.5 font-semibold">Payment</th>
                            <th className="px-3 py-2.5 font-semibold">Group Status</th>
                            <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students
                            .filter((s) => filterGroup === 'all' || s.groupStatus === filterGroup)
                            .map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5">
                                  <p className="font-medium text-[#0B1F3A]">{s.fullName}</p>
                                  <p className="font-mono text-[11px] text-slate-400">
                                    {s.bcsRegNo} · {s.batchName}
                                  </p>
                                </td>
                                <td className="px-3 py-2.5 font-mono tabular-nums">
                                  {s.whatsappNumber}
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusLabel status={s.paymentStatus} compact />
                                </td>
                                <td className="px-3 py-2.5">
                                  <StatusLabel status={s.groupStatus} compact />
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const msg = (
                                          portalSecurity?.autoNotifyTemplateBn ||
                                          'Assalamu Alaikum Dr. {name}, regarding CPR Medical Academy registration ({regNo}).'
                                        )
                                          .replace('{name}', s.fullName)
                                          .replace('{regNo}', s.bcsRegNo);
                                        const url = buildWhatsAppLink(s.whatsappNumber, msg);
                                        setConfirmModal({
                                          open: true,
                                          title: 'Confirm Opening WhatsApp Link',
                                          description: `Open WhatsApp chat with ${s.fullName} (${s.whatsappNumber})? Ensure you do not share group invite links outside verified students.`,
                                          confirmLabel: 'Open WhatsApp',
                                          onConfirm: async () => {
                                            window.open(url, '_blank', 'noopener,noreferrer');
                                            setConfirmModal(null);
                                          },
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      <span>Contact</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </button>

                                    {canModifyStudents && s.groupStatus !== 'Added' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmModal({
                                            open: true,
                                            title: 'Confirm Mark WhatsApp Added',
                                            description: `Confirm that you have manually added ${s.fullName} (${s.whatsappNumber}) to the official batch WhatsApp group and update status to "WhatsApp Group Added"?`,
                                            confirmLabel: 'Mark as Added',
                                            onConfirm: async () => {
                                              setActionBusy(true);
                                              await updateStudentStatusAndGroup(
                                                s,
                                                {
                                                  verificationStatus: 'WhatsApp Group Added',
                                                  groupStatus: 'Added',
                                                  publicRemark: s.publicRemark,
                                                  adminNotes: s.adminNotes,
                                                  note: 'Manually added to official WhatsApp group',
                                                },
                                                currentAdmin,
                                                portalSecurity?.portalAccessKey || ''
                                              );
                                              await loadData(currentAdmin);
                                              setActionBusy(false);
                                              setConfirmModal(null);
                                            },
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded bg-[#0F766E] px-2.5 py-1 font-semibold text-white hover:bg-[#0D625B]"
                                      >
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span>Mark Added</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* WhatsApp Group Records Log */}
                  <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                    <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                      WhatsApp Group Tracking History
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Candidate</th>
                            <th className="px-3 py-2">Status Change</th>
                            <th className="px-3 py-2">Note</th>
                            <th className="px-3 py-2">Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {whatsappRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                                No WhatsApp group status changes logged yet.
                              </td>
                            </tr>
                          ) : (
                            whatsappRecords.map((w) => (
                              <tr key={w.id}>
                                <td className="px-3 py-2 font-mono text-slate-500 tabular-nums">
                                  {formatTimestamp(w.createdAt)}
                                </td>
                                <td className="px-3 py-2 font-medium text-[#0B1F3A]">
                                  {w.studentName} ({w.bcsRegNo})
                                </td>
                                <td className="px-3 py-2">
                                  {w.previousGroupStatus} → <strong>{w.newGroupStatus}</strong>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{w.note}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{w.updatedByEmail}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: EXAM NOTICES & RESULTS */}
              {activeTab === 'exams' && (
                <AdminExamsTab
                  notices={notices}
                  results={results}
                  batches={batches}
                  currentAdmin={currentAdmin}
                  portalAccessKey={portalSecurity?.portalAccessKey || ''}
                  onRefresh={() => loadData(currentAdmin)}
                />
              )}

              {/* TAB 6: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                        System Audit Trail
                      </h2>
                      <p className="text-xs text-slate-600">
                        Immutable record of all payment verifications, approval updates, WhatsApp additions, and settings modifications.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Filter audit logs..."
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">Timestamp</th>
                          <th className="px-3 py-2.5 font-semibold">Actor</th>
                          <th className="px-3 py-2.5 font-semibold">Action</th>
                          <th className="px-3 py-2.5 font-semibold">Target</th>
                          <th className="px-3 py-2.5 font-semibold">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs
                          .filter(
                            (l) =>
                              !auditSearch.trim() ||
                              l.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                              l.actorEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
                              l.targetLabel.toLowerCase().includes(auditSearch.toLowerCase()) ||
                              l.details.toLowerCase().includes(auditSearch.toLowerCase())
                          )
                          .map((l) => (
                            <tr key={l.id}>
                              <td className="px-3 py-2.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                                {formatTimestamp(l.createdAt)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-slate-700">{l.actorEmail}</td>
                              <td className="px-3 py-2.5 font-semibold text-[#0B1F3A]">{l.action}</td>
                              <td className="px-3 py-2.5 text-slate-700">{l.targetLabel}</td>
                              <td className="px-3 py-2.5 text-slate-600">{l.details}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: SETTINGS */}
              {activeTab === 'settings' && (
                <AdminSettingsTab
                  academySettings={academySettings}
                  portalSecurity={portalSecurity}
                  batches={batches}
                  admins={admins}
                  invites={invites}
                  students={students}
                  notices={notices}
                  results={results}
                  currentAdmin={currentAdmin}
                  onRefresh={() => loadData(currentAdmin)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <StudentProfileDrawer
        student={activeStudent}
        batches={batches}
        currentAdmin={currentAdmin}
        portalSecurity={portalSecurity}
        onClose={() => setActiveStudent(null)}
        onUpdated={() => loadData(currentAdmin)}
      />

      <ConfirmDialog
        open={Boolean(confirmModal?.open)}
        title={confirmModal?.title || ''}
        description={confirmModal?.description || ''}
        confirmLabel={confirmModal?.confirmLabel}
        loading={actionBusy}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
};
