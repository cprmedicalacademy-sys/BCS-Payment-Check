import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  AcademySettings,
  BatchItem,
  StudentStatusToken,
  VERIFICATION_STATUSES,
} from '../types/portal';
import {
  isApprovedStatus,
  lookupStudentStatus,
  submitStudentCorrectionRequest,
} from '../services/portalService';
import { StatusLabel } from './ui/StatusBadge';
import { formatTimestamp, validateWhatsAppPhone } from '../lib/crypto';
import { PublicRoute } from './PublicHeader';

interface StatusCheckPageProps {
  settings: AcademySettings;
  batches: BatchItem[];
  onUnlockExamPortal: (portalAccessKey: string, studentInfo: StudentStatusToken) => void;
  onNavigate: (route: PublicRoute) => void;
}

export const StatusCheckPage: React.FC<StatusCheckPageProps> = ({
  settings,
  batches,
  onUnlockExamPortal,
  onNavigate,
}) => {
  const [bcsRegNo, setBcsRegNo] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ token: StudentStatusToken; lookupHash: string } | null>(null);

  // Safe Correction Request State
  const [showCorrection, setShowCorrection] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqWhatsapp, setReqWhatsapp] = useState('');
  const [reqBatch, setReqBatch] = useState(batches[0]?.name || 'CPR SPECIAL BCS CRYSTAL BATCH');
  const [reqNote, setReqNote] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqError, setReqError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setShowCorrection(false);
    setReqSuccess(false);

    if (bcsRegNo.trim().length < 3 || verificationCode.trim().length < 4) {
      setError(
        'অনুগ্রহ করে সঠিক BCS Registration Number এবং Verification Code প্রদান করুন। Please enter both your BCS Registration Number and Verification Code.'
      );
      return;
    }

    setLoading(true);
    try {
      const found = await lookupStudentStatus(bcsRegNo, verificationCode);
      if (!found) {
        setError(
          'প্রদত্ত BCS Registration Number এবং Verification Code-এর সাথে কোনো আবেদন পাওয়া যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন অথবা CPR অফিসে যোগাযোগ করুন।'
        );
      } else {
        setResult(found);
        setReqName(found.token.studentName);
        setReqBatch(found.token.batchName);
      }
    } catch {
      setError('স্ট্যাটাস যাচাই করতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    setReqError('');

    if (reqName.trim().length < 2) {
      setReqError('Please enter your corrected full name.');
      return;
    }
    if (!validateWhatsAppPhone(reqWhatsapp)) {
      setReqError('Please enter a valid WhatsApp number.');
      return;
    }

    setReqSubmitting(true);
    try {
      await submitStudentCorrectionRequest({
        lookupHash: result.lookupHash,
        bcsRegNo: bcsRegNo.trim(),
        requestedFullName: reqName.trim(),
        requestedWhatsapp: reqWhatsapp.trim(),
        requestedBatchName: reqBatch,
        note: reqNote.trim(),
      });
      setReqSuccess(true);
      setReqNote('');
    } catch {
      setReqError('Could not submit correction request. Please contact the office.');
    } finally {
      setReqSubmitting(false);
    }
  };

  const isApproved =
    result &&
    isApprovedStatus(result.token.verificationStatus) &&
    Boolean(result.token.portalAccessKey);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold text-[#1D5FA7]">
          Private Candidate Verification Lookup
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#0B1F3A] sm:text-3xl">
          Check Your Verification & Payment Status
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          আপনার ব্যক্তিগত তথ্য সুরক্ষিত রাখতে কেবল BCS Registration Number এবং আবেদন জমার সময় প্রাপ্ত Verification Code প্রবেশ করালেই কেবল আপনার নিজের আবেদনের অবস্থা দেখা যাবে।
        </p>
      </div>

      {/* Lookup Form */}
      <form
        onSubmit={handleLookup}
        className="mt-8 rounded-lg border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label
              htmlFor="status-reg"
              className="block text-sm font-medium text-[#0B1F3A]"
            >
              BCS Registration Number
            </label>
            <input
              id="status-reg"
              type="text"
              inputMode="numeric"
              required
              value={bcsRegNo}
              onChange={(e) => setBcsRegNo(e.target.value)}
              placeholder="e.g. 26133362"
              maxLength={40}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#1D5FA7] focus:outline-none focus:ring-2 focus:ring-[#1D5FA7]/20"
            />
          </div>

          <div className="md:col-span-4">
            <label
              htmlFor="status-code"
              className="block text-sm font-medium text-[#0B1F3A]"
            >
              Verification Code
            </label>
            <div className="relative mt-1.5">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="status-code"
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="XXXX-XXXX"
                className="block w-full rounded-md border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-[#1D5FA7] focus:outline-none focus:ring-2 focus:ring-[#1D5FA7]/20"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#1D5FA7] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#164A84] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>{loading ? 'Checking...' : 'Check Status'}</span>
            </button>
          </div>
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5 text-[#0F766E] shrink-0" aria-hidden="true" />
          <span>
            End-to-end token lookup: Other students&apos; personal information is never exposed or searchable.
          </span>
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-700 shrink-0" aria-hidden="true" />
            <div>
              <p>{error}</p>
              <p className="mt-1 text-xs text-red-800">
                Office Contact: {settings.contactPhone} · {settings.contactEmail}
              </p>
            </div>
          </div>
        )}
      </form>

      {/* Lookup Result */}
      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="font-mono text-xs text-slate-500 tabular-nums">
                  Application ID: {result.token.applicationId}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-[#0B1F3A]">
                  {result.token.studentName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-mono tabular-nums">
                    Reg No: {result.token.bcsRegNoMasked}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{result.token.batchName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Updated: {formatTimestamp(result.token.updatedAt)}
                  </span>
                </div>
              </div>

              <StatusLabel status={result.token.verificationStatus} />
            </div>

            {/* 3 Status Columns */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">Verification Status</p>
                <StatusLabel status={result.token.verificationStatus} />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">Payment Clearance</p>
                <StatusLabel status={result.token.paymentStatus} />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">WhatsApp Group Status</p>
                <StatusLabel status={result.token.groupStatus} />
              </div>
            </div>

            {result.token.publicRemark && (
              <div className="rounded-md border border-slate-200 bg-[#EFF6FF]/60 p-4 text-sm text-[#0B1F3A]">
                <p className="text-xs font-semibold text-[#1D5FA7]">Office Remark</p>
                <p className="mt-1 leading-relaxed">{result.token.publicRemark}</p>
              </div>
            )}

            {/* Verification Stage Overview */}
            <div className="border-t border-slate-200 pt-5">
              <p className="mb-3 text-xs font-semibold text-slate-600">
                Verification Stage Reference
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {VERIFICATION_STATUSES.map((stage) => {
                  const isCurrent = result.token.verificationStatus === stage;
                  return (
                    <div
                      key={stage}
                      className={`rounded border px-2.5 py-2 text-[11px] font-medium ${
                        isCurrent
                          ? 'border-[#1D5FA7] bg-[#EFF6FF] text-[#0B1F3A] font-semibold'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {stage}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approved Action vs Correction Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setShowCorrection((v) => !v)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Request Information Correction</span>
              </button>

              {isApproved ? (
                <button
                  type="button"
                  onClick={() =>
                    onUnlockExamPortal(result.token.portalAccessKey, result.token)
                  }
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#0F766E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0D625B] whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Open Approved Exam Portal & Results</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('exams')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D5FA7] hover:underline whitespace-nowrap shrink-0"
                >
                  <span>View Public Exam Announcements</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Safe Correction Request Form */}
          {showCorrection && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                  Submit Safe Correction Request
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Correction requests are reviewed manually by CPR Medical Academy staff and never alter payment or approval status automatically.
                </p>
              </div>

              {reqSuccess ? (
                <div className="flex items-start gap-2.5 rounded-md border border-[#99F6E4] bg-[#F0FDFA] p-4 text-sm text-[#0F766E]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    Correction request submitted successfully. The office will review and update your record shortly.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                  {reqError && (
                    <p className="text-xs text-red-700">{reqError}</p>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Corrected Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={reqName}
                        onChange={(e) => setReqName(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Corrected WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={reqWhatsapp}
                        onChange={(e) => setReqWhatsapp(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Correct Batch
                      </label>
                      <select
                        value={reqBatch}
                        onChange={(e) => setReqBatch(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Reason / Office Note
                    </label>
                    <textarea
                      rows={2}
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="Explain what needs correction..."
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={reqSubmitting}
                      className="rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16345C] disabled:opacity-60"
                    >
                      {reqSubmitting ? 'Sending...' : 'Send Correction Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
