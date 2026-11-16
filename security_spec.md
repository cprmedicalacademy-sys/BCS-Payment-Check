# Security Specification — CPR Medical Academy BCS Student Verification Portal

## 1. Data Invariants
1. **Unique BCS Registration Number**: A `students` document cannot be created unless its sanitized `regKey` does not already exist in `/reg_locks/{regKey}` AND `/reg_locks/{regKey}` is atomically created in the same batch (`existsAfter`).
2. **Mandatory Manual Review**: Public student submissions MUST initialize with `verificationStatus == 'Submitted'`, `paymentStatus == 'Pending'`, `groupStatus == 'Not Added'`, `adminNotes == ''`, and `portalAccessKey == ''` (on the status token). Students can never self-approve, self-verify payment, or self-add to WhatsApp groups.
3. **Zero Public PII Enumeration**: Public users can NEVER `list` or `get` `/students/{studentId}`, `/payment_records`, `/whatsapp_group_records`, `/audit_logs`, or `/student_status_tokens`. Student status lookup uses `get` on `/student_status_tokens/{lookupHash}` where `{lookupHash}` is the 64-character SHA-256 hex digest of `regKey + ":" + verificationCode` and contains zero phone numbers or admin notes.
4. **Approved-Only Exam Results & Restricted Notices**: `/exam_results` is strictly `isAdmin()` readable. Restricted notices and results are synced to `/restricted_portal/{portalKey}/...` where `{portalKey}` is only stored in `/settings/portal_security` (Admin-only) and on approved students' `student_status_tokens/{lookupHash}` docs.
5. **Verified Email & RBAC**: Every admin write/read requires `request.auth.token.email_verified == true` and membership in `/admins/{uid}` (or bootstrapped super-admin email `cprmedicalacademy@gmail.com`). Invites cannot escalate privileges beyond the invited role.
6. **Temporal Integrity & Immutability**: All `createdAt`/`updatedAt` timestamps must equal `request.time`. Audit logs cannot be updated or deleted.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Approval on Create**: Creating `/students/s1` with `verificationStatus: "Approved"` or `paymentStatus: "Verified"`.
2. **Shadow Ghost Field Injection**: Creating `/students/s2` with extra field `isAdminBypass: true`.
3. **Duplicate BCS Reg Bypass**: Creating `/students/s3` with an existing `regKey` or without atomically creating `/reg_locks/{regKey}`.
4. **Public Student List Scraping**: Executing `list` query on `/students` or `/student_status_tokens` without admin auth.
5. **Unverified Admin Email Spoof**: Accessing `/students` with `request.auth.token.email == 'cprmedicalacademy@gmail.com'` when `email_verified == false`.
6. **Self-Promoted Admin Role**: User creating `/admins/{uid}` with `role: "super_admin"` without a matching active `/admin_invites` record.
7. **Status Token Portal Key Injection**: Publicly creating `/student_status_tokens/{hash}` with a non-empty `portalAccessKey`.
8. **Restricted Result Scraping**: Publicly querying `/exam_results` or listing `/restricted_portal`.
9. **Viewer Role Mutation**: An admin with `role: "viewer"` attempting to update a student's `paymentStatus` or delete a student.
10. **Audit Log Tampering**: Even a `super_admin` attempting to `update` or `delete` an `/audit_logs/{logId}` document.
11. **Timestamp Forgery**: Creating `/students/s4` with a backdated `createdAt` timestamp not equal to `request.time`.
12. **Resource Exhaustion / ID Poisoning**: Creating `/students/` with a 2KB document ID or a 5,000-character `fullName`.
