import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import {
  DEFAULT_GOOGLE_SHEET_ID,
  StudentRecord,
} from '../../types/portal';
import {
  getWorkspaceAccessToken,
  signInWithGoogleWorkspace,
} from '../../lib/firebase';
import {
  buildSpreadsheetUrl,
  computeSheetSyncDiff,
  extractSpreadsheetId,
  fetchSpreadsheetMeta,
  inspectSheetRows,
  SheetSyncDiff,
  SheetSyncResult,
  SpreadsheetMeta,
  syncStudentsToGoogleSheet,
} from '../../services/sheetsService';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface GoogleSheetSyncPanelProps {
  students: StudentRecord[];
  compact?: boolean;
}

const SHEET_ID_STORAGE_KEY = 'cpr_linked_google_sheet_id';
const SHEET_TAB_STORAGE_KEY = 'cpr_linked_google_sheet_tab';

function GoogleGIcon() {
  return (
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
  );
}

export const GoogleSheetSyncPanel: React.FC<GoogleSheetSyncPanelProps> = ({
  students,
  compact = false,
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      return localStorage.getItem(SHEET_ID_STORAGE_KEY) || DEFAULT_GOOGLE_SHEET_ID;
    } catch {
      return DEFAULT_GOOGLE_SHEET_ID;
    }
  });
  const [sheetUrlInput, setSheetUrlInput] = useState(() => buildSpreadsheetUrl(spreadsheetId));
  const [editingSheetLink, setEditingSheetLink] = useState(false);

  const [accessToken, setAccessToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [connecting, setConnecting] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [meta, setMeta] = useState<SpreadsheetMeta | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    try {
      return localStorage.getItem(SHEET_TAB_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [diff, setDiff] = useState<SheetSyncDiff | null>(null);
  const [lastResult, setLastResult] = useState<SheetSyncResult | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refreshMetadataAndDiff = useCallback(
    async (tokenToUse: string, targetSheetId: string, preferredTab?: string) => {
      setInspecting(true);
      setError('');
      try {
        const fetchedMeta = await fetchSpreadsheetMeta(targetSheetId, tokenToUse);
        setMeta(fetchedMeta);

        const tabExists = fetchedMeta.sheets.some((s) => s.title === preferredTab);
        const activeTab =
          (tabExists && preferredTab) || fetchedMeta.sheets[0]?.title || '';

        if (activeTab) {
          setSelectedTab(activeTab);
          try {
            localStorage.setItem(SHEET_TAB_STORAGE_KEY, activeTab);
          } catch {
            // Ignore storage errors
          }
          const summary = await inspectSheetRows(targetSheetId, activeTab, tokenToUse);
          setDiff(computeSheetSyncDiff(students, summary));
        } else {
          setDiff(null);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          setAccessToken(null);
          setMeta(null);
          setDiff(null);
          setError('Google Sheets session expired. Please reconnect your Google account.');
        } else {
          setError(
            err?.message ||
              'Could not access this Google Sheet. Make sure your signed-in Google account has Editor permission on the spreadsheet.'
          );
        }
      } finally {
        setInspecting(false);
      }
    },
    [students]
  );

  useEffect(() => {
    const token = getWorkspaceAccessToken();
    if (token !== accessToken) {
      setAccessToken(token);
    }
    if (token) {
      refreshMetadataAndDiff(token, spreadsheetId, selectedTab);
    }
  }, [students, spreadsheetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectGoogleSheets = async () => {
    setConnecting(true);
    setError('');
    try {
      const { accessToken: freshToken } = await signInWithGoogleWorkspace();
      if (!freshToken) {
        setError('Google Sheets permission was not returned. Please grant Spreadsheet access.');
        return;
      }
      setAccessToken(freshToken);
      await refreshMetadataAndDiff(freshToken, spreadsheetId, selectedTab);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('Could not connect Google Sheets. Please allow popups and try again.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleTabChange = async (nextTab: string) => {
    setSelectedTab(nextTab);
    try {
      localStorage.setItem(SHEET_TAB_STORAGE_KEY, nextTab);
    } catch {
      // Ignore storage errors
    }
    if (!accessToken) return;
    setInspecting(true);
    setError('');
    try {
      const summary = await inspectSheetRows(spreadsheetId, nextTab, accessToken);
      setDiff(computeSheetSyncDiff(students, summary));
    } catch (err: any) {
      setError(err?.message || 'Failed to read selected sheet tab.');
    } finally {
      setInspecting(false);
    }
  };

  const handleSaveSheetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractSpreadsheetId(sheetUrlInput);
    if (!extracted) {
      setError('Please enter a valid Google Sheets URL or Spreadsheet ID.');
      return;
    }
    setSpreadsheetId(extracted);
    setSheetUrlInput(buildSpreadsheetUrl(extracted));
    setEditingSheetLink(false);
    setLastResult(null);
    try {
      localStorage.setItem(SHEET_ID_STORAGE_KEY, extracted);
      localStorage.removeItem(SHEET_TAB_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    if (accessToken) {
      await refreshMetadataAndDiff(accessToken, extracted);
    }
  };

  const handleExecuteSync = async () => {
    if (!accessToken || !meta || !selectedTab) return;
    setSyncing(true);
    setError('');
    try {
      const result = await syncStudentsToGoogleSheet({
        spreadsheetId,
        spreadsheetTitle: meta.spreadsheetTitle,
        sheetTitle: selectedTab,
        students,
        accessToken,
      });
      setLastResult(result);
      await refreshMetadataAndDiff(accessToken, spreadsheetId, selectedTab);
    } catch (err: any) {
      if (err?.status === 401) {
        setAccessToken(null);
        setError('Google Sheets access token expired. Click Connect Google Sheets and retry.');
      } else {
        setError(err?.message || 'Failed to sync student records to Google Sheet.');
      }
    } finally {
      setSyncing(false);
      setConfirmOpen(false);
    }
  };

  const pendingNewCount = diff?.newStudents.length ?? 0;
  const existingMatchCount = diff?.existingStudents.length ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                Google Sheet Live Sync
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                {meta ? meta.spreadsheetTitle : `Sheet ID: ${spreadsheetId.slice(0, 14)}…`}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Sync registered BCS students and WhatsApp verification statuses directly into your linked Excel / Google Sheet.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={buildSpreadsheetUrl(spreadsheetId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <span>Open Sheet</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {!compact && (
            <button
              type="button"
              onClick={() => setEditingSheetLink((v) => !v)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {editingSheetLink ? 'Cancel' : 'Change Sheet'}
            </button>
          )}

          {!accessToken ? (
            <button
              type="button"
              disabled={connecting}
              onClick={handleConnectGoogleSheets}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0B1F3A] shadow-xs hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <GoogleGIcon />
              <span>{connecting ? 'Connecting...' : 'Connect Google Sheets'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={inspecting || syncing}
                onClick={() => refreshMetadataAndDiff(accessToken, spreadsheetId, selectedTab)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
                title="Refresh Google Sheet status"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${inspecting ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                disabled={inspecting || syncing || !meta || !selectedTab || students.length === 0}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0F766E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0D625B] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>
                  {pendingNewCount > 0
                    ? `Sync to Sheet (${pendingNewCount} New)`
                    : 'Sync All to Sheet'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {editingSheetLink && (
        <form
          onSubmit={handleSaveSheetLink}
          className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
        >
          <input
            type="text"
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800"
          />
          <button
            type="submit"
            className="rounded-md bg-[#1D5FA7] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#164A84] whitespace-nowrap shrink-0"
          >
            Save Sheet Link
          </button>
        </form>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastResult && (
        <div className="flex items-start gap-2 rounded-md border border-[#99F6E4] bg-[#F0FDFA] p-3 text-xs text-[#0F766E]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Synced to <strong>{lastResult.spreadsheetTitle}</strong> ({lastResult.sheetTitle}):{' '}
            <strong className="font-mono tabular-nums">{lastResult.appendedCount}</strong> new row(s) added and{' '}
            <strong className="font-mono tabular-nums">{lastResult.updatedCount}</strong> existing row(s) updated.
          </span>
        </div>
      )}

      {accessToken && meta && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="font-medium text-[#0B1F3A]">Sheet Tab:</span>
              <select
                value={selectedTab}
                onChange={(e) => handleTabChange(e.target.value)}
                disabled={inspecting || syncing}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
              >
                {meta.sheets.map((s) => (
                  <option key={s.sheetId} value={s.title}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            {diff && (
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                Sheet rows: {diff.totalDataRowsInSheet} · Portal students: {students.length}
              </span>
            )}
          </div>

          {diff && (
            <div className="text-xs font-medium tabular-nums">
              {pendingNewCount > 0 ? (
                <span className="text-[#1D5FA7]">
                  {pendingNewCount} new registration(s) ready to add · {existingMatchCount} existing to update
                </span>
              ) : (
                <span className="text-[#0F766E]">
                  All {students.length} portal registrations are present in the sheet
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Sync Student Records to Google Sheet?"
        description={
          meta && diff
            ? `This will update "${meta.spreadsheetTitle}" (tab: "${selectedTab}") by appending ${pendingNewCount} new student row(s) and updating ${existingMatchCount} existing row(s) with their latest verification, payment, and WhatsApp group statuses.`
            : 'Proceed with syncing student records to your linked Google Sheet?'
        }
        confirmLabel="Sync to Google Sheet"
        loading={syncing}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleExecuteSync}
      />
    </div>
  );
};
