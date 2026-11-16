import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  MessageSquare,
  Save,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AdminUser,
  BatchItem,
  GROUP_STATUSES,
  GroupStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
  PortalSecuritySettings,
  StudentRecord,
  VERIFICATION_STATUSES,
  VerificationHistoryEntry,
  VerificationStatus,
} from '../../types/portal';
import {
  fetchStudentVerificationHistory,
  updateStudentPaymentStatus,
  updateStudentProfileInfo,
  updateStudentStatusAndGroup,
} from '../../services/portalService';
import { buildWhatsAppLink, formatTimestamp } from '../../lib/crypto';
import { StatusLabel } from '../ui/StatusBadge';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface StudentProfileDrawerProps {
  student: StudentRecord | null;
  batches: BatchItem[];
  currentAdmin: AdminUser;
  portalSecurity: PortalSecuritySettings | null;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export const StudentProfileDrawer: React.FC<StudentProfileDrawerProps> = ({
  student,
  batches,
  currentAdmin,
  portalSecurity,
  onClose,
  onUpdated,
}) => {
  const [history, setHistory] = useState<VerificationHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Profile Edit Fields
  const [fullName, setFullName] = useState('');
  const [bcsRegNo, setBcsRegNo] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [batchId, setBatchId] = useState('');
  const [publicRemark, setPublicRemark] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Status & Group Fields
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('Submitted');
  const [groupStatus, setGroupStatus] = useState<GroupStatus>('Not Added');
  const [statusNote, setStatusNote] = useState('');

  // Payment Fields
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [amountPaid, setAmountPaid] = useState('0');
  const [amountDue, setAmountDue] = useState('0');
  const [paymentNote, setPaymentNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    desc: string;
    action: () => Promise<void>;
  } | null>(null);

  const canEditProfile = currentAdmin.role === 'super_admin' || currentAdmin.role === 'admin';
  const canVerify = canEditProfile || currentAdmin.role === 'verifier';
  const portalAccessKey = portalSecurity?.portalAccessKey || '';

  useEffect(() => {
    if (!student) return;
    setFullName(student.fullName);
    setBcsRegNo(student.bcsRegNo);
    setWhatsappNumber(student.whatsappNumber);
    setBatchId(student.batchId);
    setPublicRemark(student.publicRemark);
    setAdminNotes(student.adminNotes);
    setVerificationStatus(student.verificationStatus);
    setGroupStatus(student.groupStatus);
    setPaymentStatus(student.paymentStatus);
    setStatusNote('');
    setPaymentNote('');
    setFeedback(null);

    setLoadingHistory(true);
    fetchStudentVerificationHistory(student.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [student]);

  if (!student) return null;

  const refreshHistory = async () => {
    const h = await fetchStudentVerificationHistory(student.id);
    setHistory(h);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) return;
    setSaving(true);
    setFeedback(null);
    const chosenBatch = batches.find((b) => b.id === batchId) || {
      id: student.batchId,
      name: student.batchName,
    };
    try {
      await updateStudentProfileInfo(
        student,
        {
          fullName,
          bcsRegNo,
          whatsappNumber,
          batchId: chosenBatch.id,
          batchName: chosenBatch.name,
          publicRemark,
          adminNotes,
        },
        currentAdmin
      );
      await onUpdated();
      await refreshHistory();
      setFeedback({ type: 'ok', msg: 'Student profile saved and logged to audit trail.' });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg:
          err?.message === 'DUPLICATE_REG_NO'
            ? 'That BCS Registration Number is already assigned to another student.'
            : 'Failed to update student profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const executeStatusSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateStudentStatusAndGroup(
        student,
        {
          verificationStatus,
          groupStatus,
          publicRemark,
          adminNotes,
          note: statusNote,
        },
        currentAdmin,
        portalAccessKey
      );
      await onUpdated();
      await refreshHistory();
      setStatusNote('');
      setFeedback({ type: 'ok', msg: 'Verification and WhatsApp group status updated.' });
    } catch {
      setFeedback({ type: 'err', msg: 'Failed to update verification/group status.' });
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const handleStatusSaveClick = () => {
    const sensitive =
      verificationStatus === 'Approved' ||
      verificationStatus === 'WhatsApp Group Added' ||
      verificationStatus === 'Rejected / Contact Office' ||
      groupStatus === 'Added';

    if (sensitive) {
      setConfirmState({
        open: true,
        title: 'Confirm Sensitive Status Change',
        desc: `Update ${student.fullName} (${student.bcsRegNo}) to Verification "${verificationStatus}" and WhatsApp Group "${groupStatus}"? This action will be recorded in the audit log.`,
        action: executeStatusSave,
      });
    } else {
      executeStatusSave();
    }
  };

  const executePaymentSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const autoNextVer =
        paymentStatus === 'Verified' &&
        (student.verificationStatus === 'Submitted' ||
          student.verificationStatus === 'Under Review' ||
          student.verificationStatus === 'Payment Due')
          ? 'Payment Verified'
          : paymentStatus === 'Due'
          ? 'Payment Due'
          : verificationStatus;

      await updateStudentPaymentStatus(
        student,
        {
          newPaymentStatus: paymentStatus,
          newVerificationStatus: autoNextVer,
          amountPaid: Number(amountPaid) || 0,
          amountDue: Number(amountDue) || 0,
          referenceNote: paymentNote,
          publicRemark,
        },
        currentAdmin,
        portalAccessKey
      );
      setVerificationStatus(autoNextVer);
      await onUpdated();
      await refreshHistory();
      setPaymentNote('');
      setFeedback({ type: 'ok', msg: 'Payment verification record saved.' });
    } catch {
      setFeedback({ type: 'err', msg: 'Failed to update payment status.' });
    } finally {
      setSaving(false);
      setConfirmState(null);
    }
  };

  const handleWhatsAppContact = () => {
    const template =
      portalSecurity?.autoNotifyTemplateBn ||
      'Assalamu Alaikum Dr. {name}, regarding your CPR Medical Academy BCS Registration ({regNo}).';
    const msg = template
      .replace('{name}', student.fullName)
      .replace('{regNo}', student.bcsRegNo);
    const url = buildWhatsAppLink(student.whatsappNumber, msg);

    setConfirmState({
      open: true,
      title: 'Open WhatsApp Contact',
      desc: `Open WhatsApp conversation with ${student.fullName} at ${student.whatsappNumber}? Remember to manually add the student only after payment & identity verification.`,
      action: async () => {
        window.open(url, '_blank', 'noopener,noreferrer');
        setConfirmState(null);
      },
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex justify-end bg-[#0B1F3A]/45 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <p className="font-mono text-xs text-slate-500 tabular-nums">
                {student.applicationId} · Submitted {formatTimestamp(student.createdAt)}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-bold text-[#0B1F3A]">
                {student.fullName}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusLabel status={student.verificationStatus} compact />
                <StatusLabel status={student.paymentStatus} compact />
                <StatusLabel status={student.groupStatus} compact />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close student drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-8 p-6">
            {feedback && (
              <div
                className={`flex items-center gap-2 rounded-md border p-3.5 text-xs font-medium ${
                  feedback.type === 'ok'
                    ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedback.msg}</span>
              </div>
            )}

            {/* Quick WhatsApp Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Student WhatsApp Number</p>
                <p className="font-mono text-sm font-semibold text-[#0B1F3A] tabular-nums">
                  {student.whatsappNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleWhatsAppContact}
                className="inline-flex items-center gap-2 rounded-md border border-[#0F766E] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F766E] hover:bg-[#F0FDFA] whitespace-nowrap shrink-0"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Message on WhatsApp</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {/* 1. Verification & WhatsApp Group Status */}
            <section className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                <UserCheck className="h-4 w-4 text-[#1D5FA7]" />
                <h3>Verification & WhatsApp Group Status</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Verification Status
                  </label>
                  <select
                    disabled={!canVerify}
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {VERIFICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    WhatsApp Group Status
                  </label>
                  <select
                    disabled={!canVerify}
                    value={groupStatus}
                    onChange={(e) => setGroupStatus(e.target.value as GroupStatus)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {GROUP_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Public Remark (Visible to Student on Status Check)
                </label>
                <input
                  type="text"
                  disabled={!canVerify}
                  value={publicRemark}
                  onChange={(e) => setPublicRemark(e.target.value)}
                  placeholder="e.g. Payment verified. You will be added to the WhatsApp group tonight."
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Transition Log Note (Optional)
                </label>
                <input
                  type="text"
                  disabled={!canVerify}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Internal note for verification timeline..."
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>

              {canVerify && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleStatusSaveClick}
                    className="rounded-md bg-[#1D5FA7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164A84] disabled:opacity-60"
                  >
                    Update Status & Group
                  </button>
                </div>
              )}
            </section>

            {/* 2. Manual Payment Verification */}
            <section className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                <CreditCard className="h-4 w-4 text-[#0F766E]" />
                <h3>Manual Payment Verification</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Payment Status
                  </label>
                  <select
                    disabled={!canVerify}
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {PAYMENT_STATUSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Amount Paid (BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!canVerify}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Amount Due (BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!canVerify}
                    value={amountDue}
                    onChange={(e) => setAmountDue(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Payment Reference / Admin Remark
                </label>
                <input
                  type="text"
                  disabled={!canVerify}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Receipt # / bKash TrxID / Office ledger note"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>

              {canVerify && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setConfirmState({
                        open: true,
                        title: 'Confirm Payment Update',
                        desc: `Record payment status "${paymentStatus}" (Paid: ${amountPaid} BDT, Due: ${amountDue} BDT) for ${student.fullName}?`,
                        action: executePaymentSave,
                      })
                    }
                    className="rounded-md bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60"
                  >
                    Record Payment Verification
                  </button>
                </div>
              )}
            </section>

            {/* 3. Edit Candidate Information */}
            <form onSubmit={handleSaveProfile} className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0B1F3A]">
                  Edit Student Profile & Internal Notes
                </h3>
                {!canEditProfile && (
                  <span className="text-[11px] text-slate-500">Admin role required to edit profile</span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    disabled={!canEditProfile}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    BCS Registration Number
                  </label>
                  <input
                    type="text"
                    disabled={!canEditProfile}
                    value={bcsRegNo}
                    onChange={(e) => setBcsRegNo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    disabled={!canEditProfile}
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Batch</label>
                  <select
                    disabled={!canEditProfile}
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Internal Admin Notes (Hidden from Student)
                </label>
                <textarea
                  rows={2}
                  disabled={!canEditProfile}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>

              {canEditProfile && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Profile Edits</span>
                  </button>
                </div>
              )}
            </form>

            {/* 4. Verification Timeline */}
            <section className="space-y-3 border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F3A]">
                <Clock className="h-4 w-4 text-slate-500" />
                <h3>Verification Audit History</h3>
              </div>

              {loadingHistory ? (
                <p className="text-xs text-slate-500">Loading timeline...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-slate-500">No history entries recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {history.map((h) => (
                    <div key={h.id} className="px-4 py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A]">{h.status}</span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatTimestamp(h.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-600">{h.note}</p>
                      <p className="text-[11px] text-slate-400">
                        Actor: {h.actorEmail || 'Student Submission'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        title={confirmState?.title || ''}
        description={confirmState?.desc || ''}
        loading={saving}
        onConfirm={() => confirmState?.action()}
        onCancel={() => setConfirmState(null)}
      />
    </>
  );
};
