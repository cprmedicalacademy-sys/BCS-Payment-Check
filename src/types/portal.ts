export type VerificationStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Payment Due'
  | 'Payment Verified'
  | 'Approved'
  | 'WhatsApp Group Added'
  | 'Rejected / Contact Office';

export type PaymentStatus =
  | 'Pending'
  | 'Due'
  | 'Partially Paid'
  | 'Fully Paid'
  | 'Verified';

export type GroupStatus =
  | 'Not Added'
  | 'Eligible to Add'
  | 'Added'
  | 'Contact Needed';

export type AdminRole = 'super_admin' | 'admin' | 'verifier' | 'viewer';

export type Language = 'bn' | 'en';

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  'Submitted',
  'Under Review',
  'Payment Due',
  'Payment Verified',
  'Approved',
  'WhatsApp Group Added',
  'Rejected / Contact Office',
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending',
  'Due',
  'Partially Paid',
  'Fully Paid',
  'Verified',
];

export const GROUP_STATUSES: GroupStatus[] = [
  'Not Added',
  'Eligible to Add',
  'Added',
  'Contact Needed',
];

export interface StudentRecord {
  id: string;
  applicationId: string;
  fullName: string;
  bcsRegNo: string;
  regKey: string;
  whatsappNumber: string;
  batchId: string;
  batchName: string;
  consentAccepted: boolean;
  verificationStatus: VerificationStatus;
  paymentStatus: PaymentStatus;
  groupStatus: GroupStatus;
  lookupHash: string;
  verificationCodeMasked: string;
  adminNotes: string;
  publicRemark: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StudentStatusToken {
  studentId: string;
  applicationId: string;
  studentName: string;
  bcsRegNoMasked: string;
  batchName: string;
  verificationStatus: VerificationStatus;
  paymentStatus: PaymentStatus;
  groupStatus: GroupStatus;
  publicRemark: string;
  portalAccessKey: string;
  updatedAt?: any;
}

export interface StudentUpdateRequest {
  id: string;
  lookupHash: string;
  bcsRegNo: string;
  requestedFullName: string;
  requestedWhatsapp: string;
  requestedBatchName: string;
  note: string;
  status: 'Pending' | 'Resolved' | 'Dismissed';
  createdAt?: any;
  updatedAt?: any;
}

export interface BatchItem {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: any;
}

export interface AdminUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  inviteId: string;
  updatedAt?: any;
}

export interface AdminInvite {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  invitedBy: string;
  updatedAt?: any;
}

export interface PaymentRecord {
  id: string;
  studentId: string;
  applicationId: string;
  studentName: string;
  bcsRegNo: string;
  previousStatus: PaymentStatus;
  newStatus: PaymentStatus;
  amountPaid: number;
  amountDue: number;
  referenceNote: string;
  verifiedByEmail: string;
  createdAt?: any;
}

export interface VerificationHistoryEntry {
  id: string;
  studentId: string;
  status: string;
  note: string;
  actorType: 'student' | 'admin';
  actorEmail: string;
  createdAt?: any;
}

export interface WhatsAppGroupRecord {
  id: string;
  studentId: string;
  studentName: string;
  bcsRegNo: string;
  previousGroupStatus: GroupStatus;
  newGroupStatus: GroupStatus;
  note: string;
  updatedByEmail: string;
  createdAt?: any;
}

export type NoticeCategory = 'Subject Final' | 'Grand Mock' | 'Exam Routine' | 'General Notice';

export interface ExamNotice {
  id: string;
  title: string;
  category: NoticeCategory;
  batchName: string;
  examDate: string;
  summary: string;
  attachmentName: string;
  attachmentUrl: string;
  visibility: 'public' | 'approved_only';
  isPublished: boolean;
  updatedByEmail: string;
  updatedAt?: any;
}

export type ExamResultType = 'Subject Final Examination' | 'Grand Mock Examination';

export interface ExamResult {
  id: string;
  title: string;
  examType: ExamResultType;
  batchName: string;
  examDate: string;
  summary: string;
  fileName: string;
  fileDataUrl: string;
  parsedCsvRows: string;
  isPublished: boolean;
  publishedByEmail: string;
  updatedAt?: any;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  details: string;
  actorUid: string;
  actorEmail: string;
  createdAt?: any;
}

export interface AcademySettings {
  academyName: string;
  tagline: string;
  logoUrl: string;
  contactPhone: string;
  officeWhatsapp: string;
  contactEmail: string;
  officeAddress: string;
  officeHours: string;
  banglaInstruction: string;
  banglaNotice: string;
  privacyPolicy: string;
  termsText: string;
  updatedAt?: any;
}

export interface PortalSecuritySettings {
  portalAccessKey: string;
  requireManualPaymentReview: boolean;
  autoNotifyTemplateBn: string;
  autoNotifyTemplateEn: string;
  updatedAt?: any;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'cprmedicalacademy@gmail.com';

export const DEFAULT_LOGO_PATH = '/src/assets/images/cpr_academy_emblem_1794842637829.jpg';
export const HERO_LECTURE_IMAGE = '/src/assets/images/hero_medical_lecture_1794842638985.jpg';
export const EXAM_HALL_IMAGE = '/src/assets/images/exam_prep_hall_1794842640796.jpg';

export const DEFAULT_BATCHES: BatchItem[] = [
  {
    id: 'special-bcs-crystal',
    name: 'Special BCS Crystal Batch',
    code: 'SBCS-CRYSTAL',
    description: 'Comprehensive Special BCS Medical Cadre preparation batch with Subject Final & Grand Mock series.',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'bcs-exam-batch',
    name: 'BCS Exam Batch',
    code: 'BCS-EXAM',
    description: 'Dedicated BCS Examination & Evaluation batch for regular mock assessments.',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'other',
    name: 'Other',
    code: 'OTHER',
    description: 'Other CPR Medical Academy BCS cohorts or legacy enrolled candidates.',
    isActive: true,
    sortOrder: 3,
  },
];

export const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  academyName: 'CPR Medical Academy',
  tagline: 'Your Preparation, Our Responsibility.',
  logoUrl: DEFAULT_LOGO_PATH,
  contactPhone: '+880 1700-000000',
  officeWhatsapp: '+8801700000000',
  contactEmail: 'cprmedicalacademy@gmail.com',
  officeAddress: 'CPR Medical Academy Academic Office, Shahbagh, Dhaka-1000',
  officeHours: 'Saturday – Thursday · 10:00 AM – 6:00 PM',
  banglaInstruction:
    'আপনার নাম, BCS Registration Number এবং WhatsApp Number সঠিকভাবে প্রদান করুন। অফিস থেকে আপনার পেমেন্ট ও রেজিস্ট্রেশন যাচাই করার পর WhatsApp Group-এ যুক্ত করা হবে।',
  banglaNotice:
    'যাদের তথ্য যাচাই সম্পন্ন হবে না, তারা অফিসিয়াল WhatsApp Group-এর মাধ্যমে পরীক্ষার ফলাফল ও গুরুত্বপূর্ণ আপডেট নাও পেতে পারেন। পেমেন্ট সংক্রান্ত কোনো সমস্যা থাকলে CPR Medical Academy অফিসে যোগাযোগ করুন।',
  privacyPolicy:
    'CPR Medical Academy collects your full name, BCS registration number, batch enrollment, and WhatsApp contact number solely to verify student identity, confirm tuition/course payment clearance, add eligible students to the official batch WhatsApp group, and grant approved access to Subject Final and Grand Mock exam updates. Student phone numbers and payment records are strictly restricted to authorized academy administrators and are never published or shared with third parties.',
  termsText:
    'Submitting this verification form does not automatically confirm payment clearance or grant immediate WhatsApp group membership. All registrations undergo manual verification by the CPR Medical Academy office. Providing duplicate, falsified, or misleading BCS registration details may result in hold or rejection pending in-person or direct office verification.',
};
