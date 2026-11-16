# CPR Medical Academy – BCS Student Verification Portal

Official BCS Batch Student Verification, Payment Review, WhatsApp Group Tracking, and Exam Information Portal for **CPR Medical Academy** (*Your Preparation, Our Responsibility.*).

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & Database**: Firebase Authentication (Google Sign-In for Staff/Admins) + Cloud Firestore with strict RBAC and zero-trust `firestore.rules`
- **Collections**:
  - `students` — Full candidate records (Admin-only read/update; public create restricted to `Submitted`/`Pending`/`Not Added` defaults)
  - `reg_locks` — Atomic uniqueness lock keyed by normalized BCS Registration Number (`regKey`)
  - `student_status_tokens` — SHA-256 `(regKey:verificationCode)` keyed status cards enabling private student lookup with zero PII list exposure
  - `student_update_requests` — Safe correction requests submitted by verified students
  - `batches` — Configurable BCS batches (`Special BCS Crystal Batch`, `BCS Exam Batch`, `Other`)
  - `admins` & `admin_invites` — Role-based staff access (`super_admin`, `admin`, `verifier`, `viewer`)
  - `payment_records` — Manual payment verification ledger
  - `verification_history` — Per-student status transition timeline
  - `whatsapp_group_records` — Manual WhatsApp group addition & outreach history
  - `exam_notices` & `exam_results` — Public announcements vs restricted exam results
  - `restricted_portal/{portalKey}/notices|results` — Approved-only notices & results unlocked exclusively via the `portalAccessKey` granted upon admin approval
  - `audit_logs` — Immutable administrative audit trail
  - `settings/academy` & `settings/portal_security` — Configurable office contacts, Bangla instructions, privacy policy, terms, and portal security templates

## Environment & Firebase Configuration

- `firebase-applet-config.json` holds the provisioned Firebase Web SDK client configuration (`projectId`, `appId`, `apiKey`, `authDomain`, `firestoreDatabaseId`). No admin/service-role secrets are placed in frontend code.
- `.env.example` documents runtime variables (`GEMINI_API_KEY`, `APP_URL`).
- `firestore.rules` enforces all validation constraints, server timestamps (`request.time`), atomic registration locks, and RBAC.

## Local Development & Verification

```bash
npm install
npm run lint
npm run build
npm run dev
```

## Security Rules Auditing

```bash
npx eslint firestore.rules
```

Before sharing broadly in production, review `firestore.rules` and `security_spec.md` in the Firebase Console to ensure admin emails and retention policies match institutional requirements.
