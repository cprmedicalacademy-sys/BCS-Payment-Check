import { StudentRecord } from '../types/portal';

export function normalizeRegKey(regNo: string): string {
  return regNo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

export function normalizeVerificationCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeStudentLookupHash(regNo: string, verificationCode: string): Promise<string> {
  const regKey = normalizeRegKey(regNo);
  const code = normalizeVerificationCode(verificationCode);
  return sha256Hex(`${regKey}:${code}`);
}

export function generateApplicationId(): string {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `CPR-26-${randomDigits}${suffix}`;
}

export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += chars[array[i] % chars.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function generatePortalKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  let out = 'cpr_';
  for (let i = 0; i < 32; i++) {
    out += chars[array[i] % chars.length];
  }
  return out;
}

export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function maskRegNo(regNo: string): string {
  const clean = regNo.trim();
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
}

export function maskVerificationCode(code: string): string {
  const clean = code.trim();
  if (clean.length <= 4) return '****';
  return `****-${clean.slice(-4)}`;
}

export function formatBangladeshPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits;
}

export function validateWhatsAppPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function buildWhatsAppLink(phone: string, message?: string): string {
  const normalized = formatBangladeshPhoneForWhatsApp(phone);
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${query}`;
}

export function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportStudentsToCsv(students: StudentRecord[], filename = 'cpr-bcs-students.csv'): void {
  const headers = [
    'Application ID',
    'Full Name',
    'BCS Registration Number',
    'WhatsApp Number',
    'Batch',
    'Verification Status',
    'Payment Status',
    'WhatsApp Group Status',
    'Public Remark',
    'Admin Notes',
    'Submitted At',
  ];

  const escapeCell = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = students.map((s) =>
    [
      s.applicationId,
      s.fullName,
      s.bcsRegNo,
      s.whatsappNumber,
      s.batchName,
      s.verificationStatus,
      s.paymentStatus,
      s.groupStatus,
      s.publicRemark,
      s.adminNotes,
      formatTimestamp(s.createdAt),
    ]
      .map(escapeCell)
      .join(',')
  );

  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    return row;
  });
}
