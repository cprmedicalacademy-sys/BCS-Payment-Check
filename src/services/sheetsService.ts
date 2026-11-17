import { StudentRecord } from '../types/portal';
import { formatTimestamp, normalizeRegKey } from '../lib/crypto';

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheets: SheetTabMeta[];
}

export interface SheetInspectSummary {
  hasHeader: boolean;
  totalDataRows: number;
  existingAppIdRows: Record<string, number>;
  existingRegKeyRows: Record<string, number>;
}

export interface SheetSyncDiff {
  newStudents: StudentRecord[];
  existingStudents: Array<{ student: StudentRecord; rowNumber: number }>;
  totalDataRowsInSheet: number;
  hasHeader: boolean;
}

export interface SheetSyncResult {
  appendedCount: number;
  updatedCount: number;
  sheetTitle: string;
  spreadsheetTitle: string;
}

export const SHEET_HEADER_ROW = [
  'Application ID',
  'Submitted At',
  'Full Name',
  'BCS Reg No (8-Digit)',
  'WhatsApp Number',
  'Batch',
  'Verification Status',
  'Payment Status',
  'Group Status',
  'Public Remark',
  'Admin Notes',
];

export function extractSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function buildSpreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`;
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function sheetsFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Google Sheets request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // Ignore parse error
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export async function fetchSpreadsheetMeta(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMeta> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets(properties(sheetId,title,index))`;

  const data = await sheetsFetch<{
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string; index?: number } }>;
  }>(url, accessToken);

  const sheets: SheetTabMeta[] = (data.sheets || [])
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || 'Sheet1',
      index: s.properties?.index ?? 0,
    }))
    .sort((a, b) => a.index - b.index);

  return {
    spreadsheetId,
    spreadsheetTitle: data.properties?.title || 'CPR Medical Academy Sheet',
    sheets,
  };
}

export async function inspectSheetRows(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<SheetInspectSummary> {
  const range = encodeURIComponent(`${quoteSheetTitle(sheetTitle)}!A1:K`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${range}`;

  const data = await sheetsFetch<{ values?: string[][] }>(url, accessToken);
  const rows = data.values || [];

  if (rows.length === 0) {
    return {
      hasHeader: false,
      totalDataRows: 0,
      existingAppIdRows: {},
      existingRegKeyRows: {},
    };
  }

  const firstRow = rows[0] || [];
  const firstCell = String(firstRow[0] || '').trim().toLowerCase();
  const hasHeader =
    firstCell === 'application id' ||
    firstCell === 'app id' ||
    firstCell.includes('application');

  const existingAppIdRows: Record<string, number> = {};
  const existingRegKeyRows: Record<string, number> = {};

  const startIndex = hasHeader ? 1 : 0;
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i] || [];
    const appId = String(row[0] || '').trim();
    const regNo = normalizeRegKey(String(row[3] || ''));
    const rowNumber = i + 1; // 1-based sheet row index
    if (appId) {
      existingAppIdRows[appId] = rowNumber;
    }
    if (regNo) {
      existingRegKeyRows[regNo] = rowNumber;
    }
  }

  return {
    hasHeader,
    totalDataRows: Math.max(0, rows.length - (hasHeader ? 1 : 0)),
    existingAppIdRows,
    existingRegKeyRows,
  };
}

export function computeSheetSyncDiff(
  students: StudentRecord[],
  summary: SheetInspectSummary
): SheetSyncDiff {
  const newStudents: StudentRecord[] = [];
  const existingStudents: Array<{ student: StudentRecord; rowNumber: number }> = [];

  for (const student of students) {
    const rowByApp = summary.existingAppIdRows[student.applicationId];
    const rowByReg = summary.existingRegKeyRows[normalizeRegKey(student.bcsRegNo)];
    const existingRow = rowByApp || rowByReg;
    if (existingRow) {
      existingStudents.push({ student, rowNumber: existingRow });
    } else {
      newStudents.push(student);
    }
  }

  return {
    newStudents,
    existingStudents,
    totalDataRowsInSheet: summary.totalDataRows,
    hasHeader: summary.hasHeader,
  };
}

function studentToSheetRow(s: StudentRecord): string[] {
  return [
    s.applicationId,
    formatTimestamp(s.createdAt),
    s.fullName,
    s.bcsRegNo,
    s.whatsappNumber,
    s.batchName,
    s.verificationStatus,
    s.paymentStatus,
    s.groupStatus,
    s.publicRemark || '',
    s.adminNotes || '',
  ];
}

export async function syncStudentsToGoogleSheet(params: {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  students: StudentRecord[];
  accessToken: string;
}): Promise<SheetSyncResult> {
  const { spreadsheetId, spreadsheetTitle, sheetTitle, students, accessToken } = params;
  const summary = await inspectSheetRows(spreadsheetId, sheetTitle, accessToken);
  const diff = computeSheetSyncDiff(students, summary);
  const quotedTitle = quoteSheetTitle(sheetTitle);

  // 1. Ensure header row exists at A1:K1 if sheet is empty / missing header
  if (!summary.hasHeader && summary.totalDataRows === 0) {
    const headerRange = encodeURIComponent(`${quotedTitle}!A1:K1`);
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${headerRange}?valueInputOption=USER_ENTERED`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({
          range: `${quotedTitle}!A1:K1`,
          majorDimension: 'ROWS',
          values: [SHEET_HEADER_ROW],
        }),
      }
    );
  }

  // 2. Update existing rows in place using batchUpdate
  if (diff.existingStudents.length > 0) {
    const data = diff.existingStudents.map(({ student, rowNumber }) => ({
      range: `${quotedTitle}!A${rowNumber}:K${rowNumber}`,
      majorDimension: 'ROWS',
      values: [studentToSheetRow(student)],
    }));

    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      }
    );
  }

  // 3. Append new student rows (oldest first so bottom of sheet stays chronological)
  let appendedCount = 0;
  if (diff.newStudents.length > 0) {
    const chronologicalNew = [...diff.newStudents].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });
    const appendRange = encodeURIComponent(`${quotedTitle}!A:K`);
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values: chronologicalNew.map(studentToSheetRow),
        }),
      }
    );
    appendedCount = chronologicalNew.length;
  }

  return {
    appendedCount,
    updatedCount: diff.existingStudents.length,
    sheetTitle,
    spreadsheetTitle,
  };
}
