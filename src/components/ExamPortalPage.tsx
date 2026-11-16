import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Download,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  ExamNotice,
  ExamResult,
  StudentStatusToken,
} from '../types/portal';
import {
  fetchRestrictedPortalContent,
  isApprovedStatus,
  lookupStudentStatus,
} from '../services/portalService';
import { parseCsvRows } from '../lib/crypto';
import { PublicRoute } from './PublicHeader';

interface ExamPortalPageProps {
  publicNotices: ExamNotice[];
  unlockedPortalKey: string;
  unlockedStudent: StudentStatusToken | null;
  onUnlock: (portalKey: string, student: StudentStatusToken) => void;
  onNavigate: (route: PublicRoute) => void;
}

export const ExamPortalPage: React.FC<ExamPortalPageProps> = ({
  publicNotices,
  unlockedPortalKey,
  unlockedStudent,
  onUnlock,
  onNavigate,
}) => {
  const [bcsRegNo, setBcsRegNo] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');

  const [loadingRestricted, setLoadingRestricted] = useState(false);
  const [restrictedNotices, setRestrictedNotices] = useState<ExamNotice[]>([]);
  const [restrictedResults, setRestrictedResults] = useState<ExamResult[]>([]);

  const [activeTab, setActiveTab] = useState<'all' | 'Subject Final Examination' | 'Grand Mock Examination'>('all');
  const [scoreSearch, setScoreSearch] = useState('');

  useEffect(() => {
    if (!unlockedPortalKey) return;
    let active = true;
    setLoadingRestricted(true);
    fetchRestrictedPortalContent(unlockedPortalKey)
      .then((res) => {
        if (!active) return;
        setRestrictedNotices(res.notices);
        setRestrictedResults(res.results);
      })
      .catch(() => {
        if (active) setAuthError('Unable to load restricted exam materials.');
      })
      .finally(() => {
        if (active) setLoadingRestricted(false);
      });
    return () => {
      active = false;
    };
  }, [unlockedPortalKey]);

  const handleInlineUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setVerifying(true);
    try {
      const found = await lookupStudentStatus(bcsRegNo, verificationCode);
      if (!found) {
        setAuthError(
          'Invalid BCS Registration Number or Verification Code. Please verify your credentials.'
        );
        return;
      }
      if (!isApprovedStatus(found.token.verificationStatus) || !found.token.portalAccessKey) {
        setAuthError(
          `Your current status is "${found.token.verificationStatus}". Only Approved students can access restricted Subject Final & Grand Mock Exam notices and results.`
        );
        return;
      }
      onUnlock(found.token.portalAccessKey, found.token);
    } catch {
      setAuthError('Verification check failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return restrictedResults;
    return restrictedResults.filter((r) => r.examType === activeTab);
  }, [restrictedResults, activeTab]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#1D5FA7]">
            CPR Medical Academy Examination Cell
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0B1F3A] sm:text-3xl">
            Subject Final & Grand Mock Exam Portal
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Public schedules are listed openly below. Restricted exam routines, notices, and published merit/result sheets require verified student approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('status')}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          Go to Status Check
        </button>
      </div>

      {/* Section 1: Public Announcements (Separated cleanly from restricted records) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Public Announcements & General Routine
          </h2>
          <span className="text-xs text-slate-500">Open Access</span>
        </div>

        {publicNotices.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No public announcements currently published.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {publicNotices.map((n) => (
              <article
                key={n.id}
                className="rounded-lg border border-slate-200 bg-white p-6 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#1D5FA7]">{n.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{n.batchName}</span>
                  {n.examDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {n.examDate}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                  {n.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">{n.summary}</p>
                {n.attachmentUrl && (
                  <a
                    href={n.attachmentUrl}
                    download={n.attachmentName || 'notice-attachment'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 pt-2 text-xs font-semibold text-[#1D5FA7] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{n.attachmentName || 'Download Attachment'}</span>
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Restricted Approved-Only Student Area */}
      <section className="space-y-6 border-t border-slate-200 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {unlockedPortalKey ? (
              <ShieldCheck className="h-5 w-5 text-[#0F766E]" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5 text-[#0B1F3A]" aria-hidden="true" />
            )}
            <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
              Approved Student Exam Notices & Published Results
            </h2>
          </div>
          {unlockedStudent && (
            <span className="text-xs font-medium text-[#0F766E]">
              Verified Candidate: {unlockedStudent.studentName} ({unlockedStudent.bcsRegNoMasked})
            </span>
          )}
        </div>

        {!unlockedPortalKey ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
            <div className="max-w-2xl space-y-5">
              <div>
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                  Verification Required for Restricted Exam Information
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Only students with <strong className="text-[#0B1F3A]">Approved</strong> or{' '}
                  <strong className="text-[#0B1F3A]">WhatsApp Group Added</strong> status can access Subject Final Examination and Grand Mock Examination results and restricted notices.
                </p>
              </div>

              <form onSubmit={handleInlineUnlock} className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-medium text-slate-700">
                    BCS Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    value={bcsRegNo}
                    onChange={(e) => setBcsRegNo(e.target.value)}
                    placeholder="46-102945"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-xs font-medium text-slate-700">
                    Verification Code
                  </label>
                  <div className="relative mt-1">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="XXXX-XXXX"
                      className="block w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 font-mono text-sm uppercase"
                    />
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={verifying}
                    className="inline-flex min-h-[40px] w-full items-center justify-center rounded-md bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16345C] disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {verifying ? 'Verifying...' : 'Unlock Results'}
                  </button>
                </div>
              </form>

              {authError && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
            </div>
          </div>
        ) : loadingRestricted ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
            Loading restricted exam notices and published results...
          </div>
        ) : (
          <div className="space-y-8">
            {/* Restricted Notices */}
            <div className="space-y-4">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Restricted Exam Notices & Routines
              </h3>
              {restrictedNotices.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  No restricted notices published at this time.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {restrictedNotices.map((n) => (
                    <article
                      key={n.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#0F766E]">{n.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{n.batchName}</span>
                        {n.examDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{n.examDate}</span>
                          </>
                        )}
                      </div>
                      <h4 className="font-display text-base font-bold text-[#0B1F3A]">
                        {n.title}
                      </h4>
                      <p className="text-sm text-slate-600">{n.summary}</p>
                      {n.attachmentUrl && (
                        <a
                          href={n.attachmentUrl}
                          download={n.attachmentName || 'exam-notice'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-[#1D5FA7] hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{n.attachmentName || 'Download Routine File'}</span>
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Published Results */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                  Published Exam Results
                </h3>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1">
                    {(['all', 'Subject Final Examination', 'Grand Mock Examination'] as const).map(
                      (tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                            activeTab === tab
                              ? 'bg-white text-[#0B1F3A] shadow-sm'
                              : 'text-slate-600 hover:text-[#0B1F3A]'
                          }`}
                        >
                          {tab === 'all' ? 'All Results' : tab}
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={scoreSearch}
                      onChange={(e) => setScoreSearch(e.target.value)}
                      placeholder="Filter rows by Reg No or Name..."
                      className="rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-[#1D5FA7] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {filteredResults.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
                  No published results available for this selection yet.
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredResults.map((res) => {
                    const parsedRows = res.parsedCsvRows ? parseCsvRows(res.parsedCsvRows) : [];
                    const headers = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
                    const matchingRows = scoreSearch.trim()
                      ? parsedRows.filter((row) =>
                          Object.values(row).some((v) =>
                            v.toLowerCase().includes(scoreSearch.toLowerCase())
                          )
                        )
                      : parsedRows;

                    return (
                      <div
                        key={res.id}
                        className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold text-[#1D5FA7]">{res.examType}</span>
                              <span aria-hidden="true">·</span>
                              <span>{res.batchName}</span>
                              {res.examDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">{res.examDate}</span>
                                </>
                              )}
                            </div>
                            <h4 className="font-display text-lg font-bold text-[#0B1F3A]">
                              {res.title}
                            </h4>
                            {res.summary && (
                              <p className="text-sm text-slate-600">{res.summary}</p>
                            )}
                          </div>

                          {res.fileDataUrl && (
                            <a
                              href={res.fileDataUrl}
                              download={res.fileName || 'exam-result'}
                              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Download {res.fileName || 'Result File'}</span>
                            </a>
                          )}
                        </div>

                        {parsedRows.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                <tr>
                                  {headers.map((h) => (
                                    <th key={h} className="px-4 py-2.5 font-semibold whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {matchingRows.slice(0, 50).map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    {headers.map((h) => (
                                      <td
                                        key={h}
                                        className="px-4 py-2.5 font-mono text-slate-800 tabular-nums whitespace-nowrap"
                                      >
                                        {row[h]}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {matchingRows.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={headers.length}
                                      className="px-4 py-5 text-center text-slate-500"
                                    >
                                      No candidate rows match &ldquo;{scoreSearch}&rdquo;.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {!parsedRows.length && !res.fileDataUrl && (
                          <div className="flex items-center gap-2 px-5 py-4 text-xs text-slate-500">
                            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                            <span>Result summary published above.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
