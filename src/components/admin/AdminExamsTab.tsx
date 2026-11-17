import React, { useState } from 'react';
import { FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import {
  AdminUser,
  BatchItem,
  ExamNotice,
  ExamResult,
  ExamResultType,
  NoticeCategory,
} from '../../types/portal';
import {
  deleteExamNotice,
  deleteExamResult,
  saveExamNotice,
  saveExamResult,
} from '../../services/portalService';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface AdminExamsTabProps {
  notices: ExamNotice[];
  results: ExamResult[];
  batches: BatchItem[];
  currentAdmin: AdminUser;
  portalAccessKey: string;
  onRefresh: () => Promise<void>;
}

export const AdminExamsTab: React.FC<AdminExamsTabProps> = ({
  notices,
  results,
  batches,
  currentAdmin,
  portalAccessKey,
  onRefresh,
}) => {
  const canManage = currentAdmin.role === 'super_admin' || currentAdmin.role === 'admin';
  const [subTab, setSubTab] = useState<'notices' | 'results'>('notices');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Notice Form
  const [editingNoticeId, setEditingNoticeId] = useState<string | undefined>();
  const [nTitle, setNTitle] = useState('');
  const [nCategory, setNCategory] = useState<NoticeCategory>('Subject Final');
  const [nBatch, setNBatch] = useState('All Batches');
  const [nDate, setNDate] = useState('');
  const [nSummary, setNSummary] = useState('');
  const [nVisibility, setNVisibility] = useState<'public' | 'approved_only'>('approved_only');
  const [nPublished, setNPublished] = useState(true);
  const [nFileName, setNFileName] = useState('');
  const [nFileUrl, setNFileUrl] = useState('');

  // Result Form
  const [editingResultId, setEditingResultId] = useState<string | undefined>();
  const [rTitle, setRTitle] = useState('');
  const [rType, setRType] = useState<ExamResultType>('Subject Final Examination');
  const [rBatch, setRBatch] = useState(batches[0]?.name || 'CPR SPECIAL BCS CRYSTAL BATCH');
  const [rDate, setRDate] = useState('');
  const [rSummary, setRSummary] = useState('');
  const [rFileName, setRFileName] = useState('');
  const [rFileDataUrl, setRFileDataUrl] = useState('');
  const [rCsvRows, setRCsvRows] = useState('');
  const [rPublished, setRPublished] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'notice' | 'result';
    item: ExamNotice | ExamResult;
  } | null>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'notice' | 'result'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 320 * 1024) {
      setError('File exceeds 320 KB limit. For large files, upload CSV text or reduce PDF size.');
      return;
    }
    setError('');

    if (target === 'result' && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      const textReader = new FileReader();
      textReader.onload = () => {
        setRCsvRows(String(textReader.result || '').slice(0, 240000));
      };
      textReader.readAsText(file);
    }

    const dataReader = new FileReader();
    dataReader.onload = () => {
      const dataUrl = String(dataReader.result || '');
      if (target === 'notice') {
        setNFileName(file.name);
        setNFileUrl(dataUrl);
      } else {
        setRFileName(file.name);
        setRFileDataUrl(dataUrl);
      }
    };
    dataReader.readAsDataURL(file);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      await saveExamNotice(
        {
          id: editingNoticeId,
          title: nTitle,
          category: nCategory,
          batchName: nBatch,
          examDate: nDate,
          summary: nSummary,
          attachmentName: nFileName,
          attachmentUrl: nFileUrl,
          visibility: nVisibility,
          isPublished: nPublished,
        },
        currentAdmin,
        portalAccessKey
      );
      setEditingNoticeId(undefined);
      setNTitle('');
      setNDate('');
      setNSummary('');
      setNFileName('');
      setNFileUrl('');
      await onRefresh();
    } catch {
      setError('Failed to save exam notice.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      await saveExamResult(
        {
          id: editingResultId,
          title: rTitle,
          examType: rType,
          batchName: rBatch,
          examDate: rDate,
          summary: rSummary,
          fileName: rFileName,
          fileDataUrl: rFileDataUrl,
          parsedCsvRows: rCsvRows,
          isPublished: rPublished,
        },
        currentAdmin,
        portalAccessKey
      );
      setEditingResultId(undefined);
      setRTitle('');
      setRDate('');
      setRSummary('');
      setRFileName('');
      setRFileDataUrl('');
      setRCsvRows('');
      await onRefresh();
    } catch {
      setError('Failed to publish exam result.');
    } finally {
      setSaving(false);
    }
  };

  const loadSampleCsv = () => {
    setRCsvRows(
      'BCS Reg No,Candidate Name,Batch,Score (200),Merit Position\n26133362,Dr. Ashraful Islam,CPR SPECIAL BCS CRYSTAL BATCH,168.5,1\n26982415,Dr. Tasnim Tabassum,CPR SPECIAL BCS ONLINE BATCH,162.0,2'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Exam Notices, Routines & Result Publishing
          </h2>
          <p className="text-xs text-slate-600">
            Keep public announcements separate from restricted notices and exam results (visible only to Approved students).
          </p>
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('notices')}
            className={`rounded px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'notices' ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600'
            }`}
          >
            Exam Notices & Routines ({notices.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('results')}
            className={`rounded px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'results' ? 'bg-white text-[#0B1F3A] shadow-sm' : 'text-slate-600'
            }`}
          >
            Published Results ({results.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {subTab === 'notices' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {canManage && (
            <form
              onSubmit={handleSaveNotice}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-5"
            >
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                {editingNoticeId ? 'Edit Exam Notice' : 'Publish New Notice / Routine'}
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={nTitle}
                  onChange={(e) => setNTitle(e.target.value)}
                  placeholder="Subject Final Exam Routine — Medicine"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={nCategory}
                    onChange={(e) => setNCategory(e.target.value as NoticeCategory)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="Subject Final">Subject Final</option>
                    <option value="Grand Mock">Grand Mock</option>
                    <option value="Exam Routine">Exam Routine</option>
                    <option value="General Notice">General Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Visibility</label>
                  <select
                    value={nVisibility}
                    onChange={(e) => setNVisibility(e.target.value as 'public' | 'approved_only')}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="approved_only">Approved Students Only</option>
                    <option value="public">Public Announcement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Target Batch</label>
                  <select
                    value={nBatch}
                    onChange={(e) => setNBatch(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="All Batches">All Batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Exam / Notice Date</label>
                  <input
                    type="text"
                    value={nDate}
                    onChange={(e) => setNDate(e.target.value)}
                    placeholder="28 Nov 2026 · 10:00 AM"
                    className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Summary / Instructions</label>
                <textarea
                  rows={3}
                  required
                  value={nSummary}
                  onChange={(e) => setNSummary(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Optional Attachment (PDF/Image, max 320KB)
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{nFileName || 'Choose file to attach...'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.csv"
                    onChange={(e) => handleFileUpload(e, 'notice')}
                    className="hidden"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={nPublished}
                  onChange={(e) => setNPublished(e.target.checked)}
                />
                <span>Published (visible according to visibility setting)</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1D5FA7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#164A84] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{editingNoticeId ? 'Update Notice' : 'Save Notice'}</span>
                </button>
                {editingNoticeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoticeId(undefined);
                      setNTitle('');
                      setNSummary('');
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          <div className={`space-y-3 ${canManage ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {notices.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No exam notices created yet.
              </div>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#1D5FA7]">{n.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          n.visibility === 'approved_only'
                            ? 'font-semibold text-[#0F766E]'
                            : 'text-slate-600'
                        }
                      >
                        {n.visibility === 'approved_only' ? 'Approved Students Only' : 'Public'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{n.isPublished ? 'Published' : 'Draft'}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-[#0B1F3A]">{n.title}</h4>
                    <p className="text-xs text-slate-600">{n.summary}</p>
                    <p className="text-[11px] text-slate-400">
                      {n.batchName} {n.examDate ? `· ${n.examDate}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoticeId(n.id);
                          setNTitle(n.title);
                          setNCategory(n.category);
                          setNBatch(n.batchName);
                          setNDate(n.examDate);
                          setNSummary(n.summary);
                          setNVisibility(n.visibility);
                          setNPublished(n.isPublished);
                          setNFileName(n.attachmentName);
                          setNFileUrl(n.attachmentUrl);
                        }}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'notice', item: n })}
                        className="rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                        aria-label="Delete notice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {canManage && (
            <form
              onSubmit={handleSaveResult}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 lg:col-span-5"
            >
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                {editingResultId ? 'Edit Published Result' : 'Publish Exam Result (Approved Only)'}
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-700">Result Title</label>
                <input
                  type="text"
                  required
                  value={rTitle}
                  onChange={(e) => setRTitle(e.target.value)}
                  placeholder="Subject Final 01 — Merit & Score Sheet"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Exam Type</label>
                  <select
                    value={rType}
                    onChange={(e) => setRType(e.target.value as ExamResultType)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="Subject Final Examination">Subject Final Examination</option>
                    <option value="Grand Mock Examination">Grand Mock Examination</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Batch</label>
                  <select
                    value={rBatch}
                    onChange={(e) => setRBatch(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="All Batches">All Batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Exam Date</label>
                <input
                  type="text"
                  value={rDate}
                  onChange={(e) => setRDate(e.target.value)}
                  placeholder="18 Nov 2026"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Summary Notes</label>
                <textarea
                  rows={2}
                  value={rSummary}
                  onChange={(e) => setRSummary(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Upload Result File (CSV / PDF, max 320KB)
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{rFileName || 'Upload CSV or PDF result sheet...'}</span>
                  <input
                    type="file"
                    accept=".csv,.pdf,.png,.jpg"
                    onChange={(e) => handleFileUpload(e, 'result')}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700">
                    Searchable CSV Score Table (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleCsv}
                    className="text-[11px] font-semibold text-[#1D5FA7] hover:underline"
                  >
                    Insert sample CSV format
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={rCsvRows}
                  onChange={(e) => setRCsvRows(e.target.value)}
                  placeholder="BCS Reg No,Candidate Name,Batch,Score,Rank"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-[11px]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={rPublished}
                  onChange={(e) => setRPublished(e.target.checked)}
                />
                <span>Publish to Approved Students</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>{editingResultId ? 'Update Result' : 'Publish Result'}</span>
              </button>
            </form>
          )}

          <div className={`space-y-3 ${canManage ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {results.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No exam results uploaded yet.
              </div>
            ) : (
              results.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#0F766E]">{r.examType}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.batchName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.isPublished ? 'Published (Approved Only)' : 'Unpublished'}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-[#0B1F3A]">{r.title}</h4>
                    {r.summary && <p className="text-xs text-slate-600">{r.summary}</p>}
                    <p className="text-[11px] font-mono text-slate-400">
                      {r.fileName || 'Inline CSV Table'} {r.examDate ? `· ${r.examDate}` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingResultId(r.id);
                          setRTitle(r.title);
                          setRType(r.examType);
                          setRBatch(r.batchName);
                          setRDate(r.examDate);
                          setRSummary(r.summary);
                          setRFileName(r.fileName);
                          setRFileDataUrl(r.fileDataUrl);
                          setRCsvRows(r.parsedCsvRows);
                          setRPublished(r.isPublished);
                        }}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'result', item: r })}
                        className="rounded border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                        aria-label="Delete result"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        variant="danger"
        title="Delete Exam Record"
        description={`Are you sure you want to permanently delete "${confirmDelete?.item.title}"?`}
        confirmLabel="Delete"
        loading={saving}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          setSaving(true);
          try {
            if (confirmDelete.type === 'notice') {
              await deleteExamNotice(
                confirmDelete.item as ExamNotice,
                currentAdmin,
                portalAccessKey
              );
            } else {
              await deleteExamResult(
                confirmDelete.item as ExamResult,
                currentAdmin,
                portalAccessKey
              );
            }
            await onRefresh();
          } finally {
            setSaving(false);
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
};
