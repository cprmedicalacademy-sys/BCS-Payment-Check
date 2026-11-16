/**
 * Adversarial Security Test Specification ("Dirty Dozen") for firestore.rules.
 * Documents exact negative test cases verified against CPR Medical Academy rules.
 */

export const DIRTY_DOZEN_CASES = [
  { id: 1, name: 'Self-Approval on Create', path: '/students/s1', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Shadow Ghost Field Injection', path: '/students/s2', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Duplicate BCS Reg Bypass', path: '/students/s3', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Public Student List Scraping', path: '/students', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Unverified Admin Email Spoof', path: '/students', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Self-Promoted Admin Role', path: '/admins/attacker', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Status Token Portal Key Injection', path: '/student_status_tokens/hash', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Restricted Result Scraping', path: '/exam_results', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Viewer Role Mutation', path: '/students/s1', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Audit Log Tampering', path: '/audit_logs/log1', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Timestamp Forgery', path: '/students/s4', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Resource Exhaustion / ID Poisoning', path: '/students/' + 'x'.repeat(200), expected: 'PERMISSION_DENIED' },
] as const;
