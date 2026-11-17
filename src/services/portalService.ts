import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  computeStudentLookupHash,
  generateApplicationId,
  generateDocId,
  generatePortalKey,
  generateVerificationCode,
  maskRegNo,
  maskVerificationCode,
  normalizeRegKey,
} from '../lib/crypto';
import {
  AcademySettings,
  AdminInvite,
  AdminRole,
  AdminUser,
  AuditLogEntry,
  BOOTSTRAPPED_ADMIN_EMAIL,
  BatchItem,
  DEFAULT_ACADEMY_SETTINGS,
  DEFAULT_BATCHES,
  ExamNotice,
  ExamResult,
  GroupStatus,
  PaymentRecord,
  PaymentStatus,
  PortalSecuritySettings,
  StudentRecord,
  StudentStatusToken,
  StudentUpdateRequest,
  VerificationHistoryEntry,
  VerificationStatus,
  WhatsAppGroupRecord,
} from '../types/portal';

const clampStr = (val: string | undefined | null, max: number) =>
  String(val ?? '').trim().slice(0, max);

export function isApprovedStatus(status: VerificationStatus): boolean {
  return status === 'Approved' || status === 'WhatsApp Group Added';
}

export async function fetchAcademySettings(): Promise<AcademySettings> {
  const path = 'settings/academy';
  try {
    const snap = await getDoc(doc(db, 'settings', 'academy'));
    if (!snap.exists()) {
      return DEFAULT_ACADEMY_SETTINGS;
    }
    const data = snap.data() as AcademySettings;
    return {
      ...DEFAULT_ACADEMY_SETTINGS,
      ...data,
      contactPhone:
        !data.contactPhone ||
        data.contactPhone === '+880 1700-000000' ||
        data.contactPhone === '+880 1848-274000'
          ? DEFAULT_ACADEMY_SETTINGS.contactPhone
          : data.contactPhone,
      officeWhatsapp:
        !data.officeWhatsapp ||
        data.officeWhatsapp === '+8801700000000' ||
        data.officeWhatsapp === '+8801848274000'
          ? DEFAULT_ACADEMY_SETTINGS.officeWhatsapp
          : data.officeWhatsapp,
      officeAddress:
        !data.officeAddress ||
        data.officeAddress === 'CPR Medical Academy Academic Office, Shahbagh, Dhaka-1000'
          ? DEFAULT_ACADEMY_SETTINGS.officeAddress
          : data.officeAddress,
    };
  } catch (error) {
    // Public fallback if rules deny or offline
    console.warn('Using default academy settings:', error);
    return DEFAULT_ACADEMY_SETTINGS;
  }
}

const LEGACY_PLACEHOLDER_BATCH_IDS = new Set([
  'special-bcs-crystal',
  'bcs-exam-batch',
  'other',
]);

export async function fetchActiveBatches(): Promise<BatchItem[]> {
  try {
    const q = query(collection(db, 'batches'), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) {
      return DEFAULT_BATCHES;
    }
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BatchItem, 'id'>) }));
    if (items.every((item) => LEGACY_PLACEHOLDER_BATCH_IDS.has(item.id))) {
      return DEFAULT_BATCHES;
    }
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    console.warn('Using default batches:', error);
    return DEFAULT_BATCHES;
  }
}

export async function fetchPublicExamNotices(): Promise<ExamNotice[]> {
  const path = 'exam_notices';
  try {
    const q = query(
      collection(db, 'exam_notices'),
      where('visibility', '==', 'public'),
      where('isPublished', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamNotice, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function checkDuplicateRegNo(regNo: string): Promise<boolean> {
  const regKey = normalizeRegKey(regNo);
  if (regKey.length < 3) return false;
  const path = `reg_locks/${regKey}`;
  try {
    const snap = await getDoc(doc(db, 'reg_locks', regKey));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export interface StudentRegistrationInput {
  fullName: string;
  bcsRegNo: string;
  whatsappNumber: string;
  batchId: string;
  batchName: string;
  consentAccepted: boolean;
}

export interface StudentRegistrationReceipt {
  studentId: string;
  applicationId: string;
  verificationCode: string;
  bcsRegNo: string;
  fullName: string;
  whatsappNumber: string;
  batchName: string;
  lookupHash: string;
}

export async function submitStudentRegistration(
  input: StudentRegistrationInput
): Promise<StudentRegistrationReceipt> {
  const regKey = normalizeRegKey(input.bcsRegNo);
  if (!/^\d{8}$/.test(regKey)) {
    throw new Error('INVALID_REG_NO');
  }

  const alreadyExists = await checkDuplicateRegNo(input.bcsRegNo);
  if (alreadyExists) {
    throw new Error('DUPLICATE_REG_NO');
  }

  const studentId = generateDocId('stu');
  const applicationId = generateApplicationId();
  const verificationCode = generateVerificationCode();
  const lookupHash = await computeStudentLookupHash(input.bcsRegNo, verificationCode);
  const historyId = generateDocId('vh');

  const batch = writeBatch(db);

  batch.set(doc(db, 'reg_locks', regKey), {
    regKey,
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, 'students', studentId), {
    applicationId,
    fullName: clampStr(input.fullName, 140),
    bcsRegNo: clampStr(input.bcsRegNo, 40),
    regKey,
    whatsappNumber: clampStr(input.whatsappNumber, 24),
    batchId: clampStr(input.batchId, 80),
    batchName: clampStr(input.batchName, 120),
    consentAccepted: true,
    verificationStatus: 'Submitted',
    paymentStatus: 'Pending',
    groupStatus: 'Not Added',
    lookupHash,
    verificationCodeMasked: maskVerificationCode(verificationCode),
    adminNotes: '',
    publicRemark: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'student_status_tokens', lookupHash), {
    studentId,
    applicationId,
    studentName: clampStr(input.fullName, 140),
    bcsRegNoMasked: maskRegNo(input.bcsRegNo),
    batchName: clampStr(input.batchName, 120),
    verificationStatus: 'Submitted',
    paymentStatus: 'Pending',
    groupStatus: 'Not Added',
    publicRemark: '',
    portalAccessKey: '',
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'verification_history', historyId), {
    studentId,
    status: 'Submitted',
    note: 'Initial registration submitted by student. Awaiting CPR office manual review.',
    actorType: 'student',
    actorEmail: '',
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${studentId}`);
  }

  return {
    studentId,
    applicationId,
    verificationCode,
    bcsRegNo: input.bcsRegNo.trim(),
    fullName: input.fullName.trim(),
    whatsappNumber: input.whatsappNumber.trim(),
    batchName: input.batchName.trim(),
    lookupHash,
  };
}

export async function lookupStudentStatus(
  bcsRegNo: string,
  verificationCode: string
): Promise<{ token: StudentStatusToken; lookupHash: string } | null> {
  const lookupHash = await computeStudentLookupHash(bcsRegNo, verificationCode);
  const path = `student_status_tokens/${lookupHash}`;
  try {
    const snap = await getDoc(doc(db, 'student_status_tokens', lookupHash));
    if (!snap.exists()) return null;
    return {
      token: snap.data() as StudentStatusToken,
      lookupHash,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitStudentCorrectionRequest(payload: {
  lookupHash: string;
  bcsRegNo: string;
  requestedFullName: string;
  requestedWhatsapp: string;
  requestedBatchName: string;
  note: string;
}): Promise<void> {
  const reqId = generateDocId('req');
  const path = `student_update_requests/${reqId}`;
  try {
    await setDoc(doc(db, 'student_update_requests', reqId), {
      lookupHash: payload.lookupHash,
      bcsRegNo: clampStr(payload.bcsRegNo, 40),
      requestedFullName: clampStr(payload.requestedFullName, 140),
      requestedWhatsapp: clampStr(payload.requestedWhatsapp, 24),
      requestedBatchName: clampStr(payload.requestedBatchName, 120),
      note: clampStr(payload.note, 500),
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchRestrictedPortalContent(portalAccessKey: string): Promise<{
  notices: ExamNotice[];
  results: ExamResult[];
}> {
  if (!portalAccessKey || portalAccessKey.length < 24) {
    return { notices: [], results: [] };
  }
  try {
    const [noticesSnap, resultsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'restricted_portal', portalAccessKey, 'notices'),
          where('isPublished', '==', true)
        )
      ),
      getDocs(
        query(
          collection(db, 'restricted_portal', portalAccessKey, 'results'),
          where('isPublished', '==', true)
        )
      ),
    ]);

    return {
      notices: noticesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExamNotice, 'id'>),
      })),
      results: resultsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExamResult, 'id'>),
      })),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `restricted_portal/${portalAccessKey}`);
  }
}

// --- ADMIN AUTH & SEEDING ---

export async function resolveOrActivateAdminUser(user: User): Promise<AdminUser | null> {
  if (!user.emailVerified || !user.email) return null;
  const emailLower = user.email.toLowerCase();

  try {
    const adminRef = doc(db, 'admins', user.uid);
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      const data = adminSnap.data() as Omit<AdminUser, 'id'>;
      return data.active ? { id: adminSnap.id, ...data } : null;
    }

    if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
      const profile: Omit<AdminUser, 'id'> = {
        uid: user.uid,
        email: user.email,
        displayName: clampStr(user.displayName || 'Super Admin', 120),
        role: 'super_admin',
        active: true,
        inviteId: '',
        updatedAt: serverTimestamp(),
      };
      await setDoc(adminRef, profile);
      return { id: user.uid, ...profile };
    }

    // Check invite by verified email
    const invitesQ = query(
      collection(db, 'admin_invites'),
      where('email', '==', user.email)
    );
    const inviteSnap = await getDocs(invitesQ);
    const activeInvite = inviteSnap.docs.find((d) => d.data().active === true);
    if (activeInvite) {
      const inv = activeInvite.data() as Omit<AdminInvite, 'id'>;
      const profile: Omit<AdminUser, 'id'> = {
        uid: user.uid,
        email: user.email,
        displayName: clampStr(user.displayName || inv.displayName, 120),
        role: inv.role,
        active: true,
        inviteId: activeInvite.id,
        updatedAt: serverTimestamp(),
      };
      await setDoc(adminRef, profile);
      return { id: user.uid, ...profile };
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
  }
}

export async function seedDefaultsIfNeeded(adminUser: AdminUser): Promise<string> {
  if (adminUser.role !== 'super_admin' && adminUser.role !== 'admin') {
    const secSnap = await getDoc(doc(db, 'settings', 'portal_security'));
    return secSnap.exists() ? (secSnap.data() as PortalSecuritySettings).portalAccessKey : '';
  }

  let portalKey = '';
  try {
    const secRef = doc(db, 'settings', 'portal_security');
    const secSnap = await getDoc(secRef);
    if (secSnap.exists()) {
      portalKey = (secSnap.data() as PortalSecuritySettings).portalAccessKey;
    } else if (adminUser.role === 'super_admin') {
      portalKey = generatePortalKey();
      await setDoc(secRef, {
        portalAccessKey: portalKey,
        requireManualPaymentReview: true,
        autoNotifyTemplateBn:
          'আসসালামু আলাইকুম ডাঃ {name}, CPR Medical Academy-তে আপনার BCS Registration ({regNo}) যাচাই সম্পন্ন হয়েছে। আপনাকে শীঘ্রই অফিসিয়াল WhatsApp Group-এ যুক্ত করা হবে।',
        autoNotifyTemplateEn:
          'Dear Dr. {name}, your CPR Medical Academy registration ({regNo}) is currently under review. Please contact our office if you have payment queries.',
        updatedAt: serverTimestamp(),
      });
    }

    if (adminUser.role === 'super_admin') {
      const academyRef = doc(db, 'settings', 'academy');
      const academySnap = await getDoc(academyRef);
      if (!academySnap.exists()) {
        await setDoc(academyRef, {
          ...DEFAULT_ACADEMY_SETTINGS,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const batchesSnap = await getDocs(collection(db, 'batches'));
    const onlyLegacyPlaceholderBatches =
      !batchesSnap.empty &&
      batchesSnap.docs.every((d) => LEGACY_PLACEHOLDER_BATCH_IDS.has(d.id));
    if (batchesSnap.empty || onlyLegacyPlaceholderBatches) {
      const batchWrite = writeBatch(db);
      if (onlyLegacyPlaceholderBatches) {
        for (const legacyDoc of batchesSnap.docs) {
          batchWrite.delete(doc(db, 'batches', legacyDoc.id));
        }
      }
      for (const b of DEFAULT_BATCHES) {
        batchWrite.set(doc(db, 'batches', b.id), {
          name: b.name,
          code: b.code,
          description: b.description,
          isActive: b.isActive,
          sortOrder: b.sortOrder,
          updatedAt: serverTimestamp(),
        });
      }
      await batchWrite.commit();
    }

    const noticesSnap = await getDocs(collection(db, 'exam_notices'));
    if (noticesSnap.empty) {
      const batchWrite = writeBatch(db);
      const publicNoticeId = 'notice_public_orientation';
      batchWrite.set(doc(db, 'exam_notices', publicNoticeId), {
        title: 'BCS Batch Verification & Exam Update Protocol',
        category: 'General Notice',
        batchName: 'All Batches',
        examDate: 'Ongoing 2026',
        summary:
          'All candidates enrolled in CPR Special BCS Online Batch, Crystal Exam Batch for Special BCS, CPR Special BCS Crystal Batch, and CPR BCS Special Batch must complete verification through this portal to receive Subject Final and Grand Mock Exam schedules and results.',
        attachmentName: '',
        attachmentUrl: '',
        visibility: 'public',
        isPublished: true,
        updatedByEmail: adminUser.email,
        updatedAt: serverTimestamp(),
      });

      if (portalKey) {
        const restrictedNoticeId = 'notice_subject_final_schedule';
        const restrictedData = {
          title: 'Subject Final Examination — Medicine & Surgery Combined Routine',
          category: 'Subject Final',
          batchName: 'Special BCS Crystal Batch',
          examDate: '25 Nov 2026 · 10:00 AM',
          summary:
            'Approved students must join the exam portal 15 minutes prior to start time. Full syllabus covers General Medicine, Surgery, and Clinical Pharmacology.',
          attachmentName: '',
          attachmentUrl: '',
          visibility: 'approved_only',
          isPublished: true,
          updatedByEmail: adminUser.email,
          updatedAt: serverTimestamp(),
        };
        batchWrite.set(doc(db, 'exam_notices', restrictedNoticeId), restrictedData);
        batchWrite.set(
          doc(db, 'restricted_portal', portalKey, 'notices', restrictedNoticeId),
          restrictedData
        );
      }
      await batchWrite.commit();
    }
  } catch (error) {
    console.warn('Seed check warning:', error);
  }

  return portalKey;
}

// --- ADMIN DATA FETCHERS ---

export async function fetchAllAdminCollections() {
  try {
    const [
      studentsSnap,
      batchesSnap,
      paymentsSnap,
      whatsappSnap,
      noticesSnap,
      resultsSnap,
      auditSnap,
      updateReqSnap,
      adminsSnap,
      invitesSnap,
      secSnap,
    ] = await Promise.all([
      getDocs(query(collection(db, 'students'), orderBy('createdAt', 'desc'))),
      getDocs(collection(db, 'batches')),
      getDocs(query(collection(db, 'payment_records'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'whatsapp_group_records'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'exam_notices'), orderBy('updatedAt', 'desc'))),
      getDocs(query(collection(db, 'exam_results'), orderBy('updatedAt', 'desc'))),
      getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'student_update_requests'), orderBy('createdAt', 'desc'))),
      getDocs(collection(db, 'admins')),
      getDocs(collection(db, 'admin_invites')),
      getDoc(doc(db, 'settings', 'portal_security')),
    ]);

    return {
      students: studentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StudentRecord, 'id'>) })),
      batches: batchesSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<BatchItem, 'id'>) }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      payments: paymentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) })),
      whatsappRecords: whatsappSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WhatsAppGroupRecord, 'id'>),
      })),
      notices: noticesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamNotice, 'id'>) })),
      results: resultsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamResult, 'id'>) })),
      auditLogs: auditSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, 'id'>) })),
      updateRequests: updateReqSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StudentUpdateRequest, 'id'>),
      })),
      admins: adminsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminUser, 'id'>) })),
      invites: invitesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminInvite, 'id'>) })),
      portalSecurity: secSnap.exists() ? (secSnap.data() as PortalSecuritySettings) : null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_collections');
  }
}

export async function fetchStudentVerificationHistory(
  studentId: string
): Promise<VerificationHistoryEntry[]> {
  try {
    const q = query(
      collection(db, 'verification_history'),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<VerificationHistoryEntry, 'id'>) }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'verification_history');
  }
}

// --- ADMIN MUTATIONS ---

export async function updateStudentProfileInfo(
  student: StudentRecord,
  updates: {
    fullName: string;
    bcsRegNo: string;
    whatsappNumber: string;
    batchId: string;
    batchName: string;
    publicRemark: string;
    adminNotes: string;
  },
  actor: AdminUser
): Promise<void> {
  const newRegKey = normalizeRegKey(updates.bcsRegNo);
  const oldRegKey = student.regKey;
  const regChanged = newRegKey !== oldRegKey;

  if (regChanged) {
    const existingLock = await getDoc(doc(db, 'reg_locks', newRegKey));
    if (existingLock.exists()) {
      throw new Error('DUPLICATE_REG_NO');
    }
  }

  const batch = writeBatch(db);
  if (regChanged) {
    batch.set(doc(db, 'reg_locks', newRegKey), {
      regKey: newRegKey,
      createdAt: serverTimestamp(),
    });
    batch.delete(doc(db, 'reg_locks', oldRegKey));
  }

  batch.update(doc(db, 'students', student.id), {
    fullName: clampStr(updates.fullName, 140),
    bcsRegNo: clampStr(updates.bcsRegNo, 40),
    regKey: newRegKey,
    whatsappNumber: clampStr(updates.whatsappNumber, 24),
    batchId: clampStr(updates.batchId, 80),
    batchName: clampStr(updates.batchName, 120),
    publicRemark: clampStr(updates.publicRemark, 500),
    adminNotes: clampStr(updates.adminNotes, 1000),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'student_status_tokens', student.lookupHash), {
    studentName: clampStr(updates.fullName, 140),
    bcsRegNoMasked: maskRegNo(updates.bcsRegNo),
    batchName: clampStr(updates.batchName, 120),
    publicRemark: clampStr(updates.publicRemark, 500),
    updatedAt: serverTimestamp(),
  });

  const auditId = generateDocId('aud');
  batch.set(doc(db, 'audit_logs', auditId), {
    action: 'Updated Student Profile',
    targetType: 'student',
    targetId: student.id,
    targetLabel: `${updates.fullName} (${updates.bcsRegNo})`,
    details: `Edited student profile fields${regChanged ? ` (Reg No changed from ${student.bcsRegNo} to ${updates.bcsRegNo})` : ''}.`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
  }
}

export async function updateStudentPaymentStatus(
  student: StudentRecord,
  params: {
    newPaymentStatus: PaymentStatus;
    newVerificationStatus?: VerificationStatus;
    amountPaid: number;
    amountDue: number;
    referenceNote: string;
    publicRemark?: string;
  },
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const nextVerStatus = params.newVerificationStatus ?? student.verificationStatus;
  const nextPublicRemark = params.publicRemark ?? student.publicRemark;
  const batch = writeBatch(db);

  batch.update(doc(db, 'students', student.id), {
    paymentStatus: params.newPaymentStatus,
    verificationStatus: nextVerStatus,
    publicRemark: clampStr(nextPublicRemark, 500),
    adminNotes: clampStr(
      params.referenceNote ? `[Payment] ${params.referenceNote}\n${student.adminNotes}`.trim() : student.adminNotes,
      1000
    ),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'student_status_tokens', student.lookupHash), {
    paymentStatus: params.newPaymentStatus,
    verificationStatus: nextVerStatus,
    publicRemark: clampStr(nextPublicRemark, 500),
    portalAccessKey: isApprovedStatus(nextVerStatus) ? portalAccessKey : '',
    updatedAt: serverTimestamp(),
  });

  const payId = generateDocId('pay');
  batch.set(doc(db, 'payment_records', payId), {
    studentId: student.id,
    applicationId: student.applicationId,
    studentName: student.fullName,
    bcsRegNo: student.bcsRegNo,
    previousStatus: student.paymentStatus,
    newStatus: params.newPaymentStatus,
    amountPaid: Math.max(0, Number(params.amountPaid) || 0),
    amountDue: Math.max(0, Number(params.amountDue) || 0),
    referenceNote: clampStr(params.referenceNote, 500),
    verifiedByEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  const vhId = generateDocId('vh');
  batch.set(doc(db, 'verification_history', vhId), {
    studentId: student.id,
    status: `Payment: ${params.newPaymentStatus}`,
    note: clampStr(params.referenceNote || `Payment set to ${params.newPaymentStatus}`, 500),
    actorType: 'admin',
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  const audId = generateDocId('aud');
  batch.set(doc(db, 'audit_logs', audId), {
    action: 'Payment Verification Updated',
    targetType: 'student',
    targetId: student.id,
    targetLabel: `${student.fullName} (${student.bcsRegNo})`,
    details: `Payment: ${student.paymentStatus} -> ${params.newPaymentStatus} (Paid: ${params.amountPaid}, Due: ${params.amountDue}). Note: ${params.referenceNote || 'None'}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
  }
}

export async function updateStudentStatusAndGroup(
  student: StudentRecord,
  params: {
    verificationStatus: VerificationStatus;
    groupStatus: GroupStatus;
    publicRemark: string;
    adminNotes: string;
    note?: string;
  },
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const batch = writeBatch(db);
  const groupChanged = params.groupStatus !== student.groupStatus;
  const verChanged = params.verificationStatus !== student.verificationStatus;

  batch.update(doc(db, 'students', student.id), {
    verificationStatus: params.verificationStatus,
    groupStatus: params.groupStatus,
    publicRemark: clampStr(params.publicRemark, 500),
    adminNotes: clampStr(params.adminNotes, 1000),
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'student_status_tokens', student.lookupHash), {
    verificationStatus: params.verificationStatus,
    groupStatus: params.groupStatus,
    publicRemark: clampStr(params.publicRemark, 500),
    portalAccessKey: isApprovedStatus(params.verificationStatus) ? portalAccessKey : '',
    updatedAt: serverTimestamp(),
  });

  if (verChanged || params.note) {
    batch.set(doc(db, 'verification_history', generateDocId('vh')), {
      studentId: student.id,
      status: params.verificationStatus,
      note: clampStr(params.note || params.publicRemark || `Status updated to ${params.verificationStatus}`, 500),
      actorType: 'admin',
      actorEmail: actor.email,
      createdAt: serverTimestamp(),
    });
  }

  if (groupChanged) {
    batch.set(doc(db, 'whatsapp_group_records', generateDocId('wa')), {
      studentId: student.id,
      studentName: student.fullName,
      bcsRegNo: student.bcsRegNo,
      previousGroupStatus: student.groupStatus,
      newGroupStatus: params.groupStatus,
      note: clampStr(params.note || `Group status set to ${params.groupStatus}`, 500),
      updatedByEmail: actor.email,
      createdAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: groupChanged && !verChanged ? 'WhatsApp Group Status Updated' : 'Student Status Updated',
    targetType: 'student',
    targetId: student.id,
    targetLabel: `${student.fullName} (${student.bcsRegNo})`,
    details: `Verification: ${student.verificationStatus} -> ${params.verificationStatus}; Group: ${student.groupStatus} -> ${params.groupStatus}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
  }
}

export async function bulkUpdateStudentsStatus(
  students: StudentRecord[],
  updates: {
    verificationStatus?: VerificationStatus;
    paymentStatus?: PaymentStatus;
    groupStatus?: GroupStatus;
    publicRemark?: string;
  },
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const batch = writeBatch(db);

  for (const s of students) {
    const nextVer = updates.verificationStatus ?? s.verificationStatus;
    const nextPay = updates.paymentStatus ?? s.paymentStatus;
    const nextGrp = updates.groupStatus ?? s.groupStatus;
    const nextRemark = updates.publicRemark !== undefined ? updates.publicRemark : s.publicRemark;

    batch.update(doc(db, 'students', s.id), {
      verificationStatus: nextVer,
      paymentStatus: nextPay,
      groupStatus: nextGrp,
      publicRemark: clampStr(nextRemark, 500),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'student_status_tokens', s.lookupHash), {
      verificationStatus: nextVer,
      paymentStatus: nextPay,
      groupStatus: nextGrp,
      publicRemark: clampStr(nextRemark, 500),
      portalAccessKey: isApprovedStatus(nextVer) ? portalAccessKey : '',
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'verification_history', generateDocId('vh')), {
      studentId: s.id,
      status: nextVer,
      note: clampStr(
        `Bulk update by ${actor.email} (Verification: ${nextVer}, Payment: ${nextPay}, Group: ${nextGrp})`,
        500
      ),
      actorType: 'admin',
      actorEmail: actor.email,
      createdAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Bulk Student Status Update',
    targetType: 'bulk_students',
    targetId: `${students.length}_records`,
    targetLabel: `${students.length} Students`,
    details: `Bulk applied updates: ${JSON.stringify(updates)}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'students/bulk');
  }
}

export async function resolveCorrectionRequest(
  req: StudentUpdateRequest,
  newStatus: 'Resolved' | 'Dismissed',
  note: string,
  actor: AdminUser
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'student_update_requests', req.id), {
    status: newStatus,
    note: clampStr(note, 500),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: `Correction Request ${newStatus}`,
    targetType: 'update_request',
    targetId: req.id,
    targetLabel: `${req.requestedFullName} (${req.bcsRegNo})`,
    details: clampStr(note || `Marked as ${newStatus}`, 1000),
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `student_update_requests/${req.id}`);
  }
}

// --- EXAM NOTICES & RESULTS ---

export async function saveExamNotice(
  notice: Omit<ExamNotice, 'id' | 'updatedAt' | 'updatedByEmail'> & { id?: string },
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const id = notice.id || generateDocId('not');
  const payload = {
    title: clampStr(notice.title, 200),
    category: notice.category,
    batchName: clampStr(notice.batchName, 120),
    examDate: clampStr(notice.examDate, 60),
    summary: clampStr(notice.summary, 2000),
    attachmentName: clampStr(notice.attachmentName, 180),
    attachmentUrl: notice.attachmentUrl.slice(0, 450000),
    visibility: notice.visibility,
    isPublished: notice.isPublished,
    updatedByEmail: actor.email,
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'exam_notices', id), payload);

  if (portalAccessKey) {
    const restrictedRef = doc(db, 'restricted_portal', portalAccessKey, 'notices', id);
    if (notice.visibility === 'approved_only' && notice.isPublished) {
      batch.set(restrictedRef, payload);
    } else {
      batch.delete(restrictedRef);
    }
  }

  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: notice.id ? 'Updated Exam Notice' : 'Created Exam Notice',
    targetType: 'exam_notice',
    targetId: id,
    targetLabel: payload.title,
    details: `Category: ${payload.category}, Visibility: ${payload.visibility}, Published: ${payload.isPublished}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `exam_notices/${id}`);
  }
}

export async function deleteExamNotice(
  notice: ExamNotice,
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'exam_notices', notice.id));
  if (portalAccessKey) {
    batch.delete(doc(db, 'restricted_portal', portalAccessKey, 'notices', notice.id));
  }
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Deleted Exam Notice',
    targetType: 'exam_notice',
    targetId: notice.id,
    targetLabel: notice.title,
    details: `Deleted notice (${notice.category})`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `exam_notices/${notice.id}`);
  }
}

export async function saveExamResult(
  result: Omit<ExamResult, 'id' | 'updatedAt' | 'publishedByEmail'> & { id?: string },
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const id = result.id || generateDocId('res');
  const payload = {
    title: clampStr(result.title, 200),
    examType: result.examType,
    batchName: clampStr(result.batchName, 120),
    examDate: clampStr(result.examDate, 60),
    summary: clampStr(result.summary, 1000),
    fileName: clampStr(result.fileName, 180),
    fileDataUrl: result.fileDataUrl.slice(0, 450000),
    parsedCsvRows: result.parsedCsvRows.slice(0, 250000),
    isPublished: result.isPublished,
    publishedByEmail: actor.email,
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'exam_results', id), payload);

  if (portalAccessKey) {
    const restrictedRef = doc(db, 'restricted_portal', portalAccessKey, 'results', id);
    if (result.isPublished) {
      batch.set(restrictedRef, payload);
    } else {
      batch.delete(restrictedRef);
    }
  }

  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: result.id ? 'Updated Exam Result' : 'Published Exam Result',
    targetType: 'exam_result',
    targetId: id,
    targetLabel: payload.title,
    details: `Type: ${payload.examType}, Batch: ${payload.batchName}, Published: ${payload.isPublished}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `exam_results/${id}`);
  }
}

export async function deleteExamResult(
  result: ExamResult,
  actor: AdminUser,
  portalAccessKey: string
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'exam_results', result.id));
  if (portalAccessKey) {
    batch.delete(doc(db, 'restricted_portal', portalAccessKey, 'results', result.id));
  }
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Deleted Exam Result',
    targetType: 'exam_result',
    targetId: result.id,
    targetLabel: result.title,
    details: `Deleted result (${result.examType})`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `exam_results/${result.id}`);
  }
}

// --- SETTINGS, BATCHES & ADMIN USERS ---

export async function saveBatchItem(
  batchItem: Omit<BatchItem, 'updatedAt'>,
  actor: AdminUser
): Promise<void> {
  const id = batchItem.id || generateDocId('batch');
  const batch = writeBatch(db);
  batch.set(doc(db, 'batches', id), {
    name: clampStr(batchItem.name, 120),
    code: clampStr(batchItem.code, 32),
    description: clampStr(batchItem.description, 400),
    isActive: batchItem.isActive,
    sortOrder: Number(batchItem.sortOrder) || 1,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Saved Batch Configuration',
    targetType: 'batch',
    targetId: id,
    targetLabel: batchItem.name,
    details: `Code: ${batchItem.code}, Active: ${batchItem.isActive}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `batches/${id}`);
  }
}

export async function saveAcademySettingsDoc(
  settings: AcademySettings,
  actor: AdminUser
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'settings', 'academy'), {
    academyName: clampStr(settings.academyName, 140),
    tagline: clampStr(settings.tagline, 200),
    logoUrl: settings.logoUrl.slice(0, 200000),
    contactPhone: clampStr(settings.contactPhone, 40),
    officeWhatsapp: clampStr(settings.officeWhatsapp, 40),
    contactEmail: clampStr(settings.contactEmail, 120),
    officeAddress: clampStr(settings.officeAddress, 300),
    officeHours: clampStr(settings.officeHours, 160),
    banglaInstruction: clampStr(settings.banglaInstruction, 1200),
    banglaNotice: clampStr(settings.banglaNotice, 1200),
    privacyPolicy: clampStr(settings.privacyPolicy, 3000),
    termsText: clampStr(settings.termsText, 3000),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Updated Academy Settings',
    targetType: 'settings',
    targetId: 'academy',
    targetLabel: settings.academyName,
    details: 'Updated academy branding, office contact, Bangla notices, and privacy policy.',
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/academy');
  }
}

export async function savePortalSecurityAndRotateIfNeeded(
  security: PortalSecuritySettings,
  rotateKey: boolean,
  students: StudentRecord[],
  notices: ExamNotice[],
  results: ExamResult[],
  actor: AdminUser
): Promise<string> {
  const nextKey = rotateKey ? generatePortalKey() : security.portalAccessKey;
  const batch = writeBatch(db);

  batch.set(doc(db, 'settings', 'portal_security'), {
    portalAccessKey: nextKey,
    requireManualPaymentReview: security.requireManualPaymentReview,
    autoNotifyTemplateBn: clampStr(security.autoNotifyTemplateBn, 800),
    autoNotifyTemplateEn: clampStr(security.autoNotifyTemplateEn, 800),
    updatedAt: serverTimestamp(),
  });

  if (rotateKey) {
    for (const s of students) {
      if (isApprovedStatus(s.verificationStatus)) {
        batch.update(doc(db, 'student_status_tokens', s.lookupHash), {
          portalAccessKey: nextKey,
          updatedAt: serverTimestamp(),
        });
      }
    }
    for (const n of notices) {
      if (n.visibility === 'approved_only' && n.isPublished) {
        batch.set(doc(db, 'restricted_portal', nextKey, 'notices', n.id), {
          title: n.title,
          category: n.category,
          batchName: n.batchName,
          examDate: n.examDate,
          summary: n.summary,
          attachmentName: n.attachmentName,
          attachmentUrl: n.attachmentUrl,
          visibility: n.visibility,
          isPublished: n.isPublished,
          updatedByEmail: actor.email,
          updatedAt: serverTimestamp(),
        });
      }
    }
    for (const r of results) {
      if (r.isPublished) {
        batch.set(doc(db, 'restricted_portal', nextKey, 'results', r.id), {
          title: r.title,
          examType: r.examType,
          batchName: r.batchName,
          examDate: r.examDate,
          summary: r.summary,
          fileName: r.fileName,
          fileDataUrl: r.fileDataUrl,
          parsedCsvRows: r.parsedCsvRows,
          isPublished: r.isPublished,
          publishedByEmail: r.publishedByEmail,
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: rotateKey ? 'Rotated Portal Access Key' : 'Updated Portal Security Settings',
    targetType: 'settings',
    targetId: 'portal_security',
    targetLabel: 'Portal Security',
    details: rotateKey
      ? 'Rotated approved-student portal access key and resynced approved tokens and restricted resources.'
      : 'Updated portal notification templates and review settings.',
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/portal_security');
  }

  return nextKey;
}

export async function createAdminInvite(
  invite: { email: string; displayName: string; role: AdminRole },
  actor: AdminUser
): Promise<void> {
  const id = generateDocId('inv');
  const batch = writeBatch(db);
  batch.set(doc(db, 'admin_invites', id), {
    email: clampStr(invite.email.toLowerCase(), 160),
    displayName: clampStr(invite.displayName, 120),
    role: invite.role,
    active: true,
    invitedBy: actor.email,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Invited Admin User',
    targetType: 'admin_invite',
    targetId: id,
    targetLabel: invite.email,
    details: `Invited ${invite.email} with role ${invite.role}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admin_invites/${id}`);
  }
}

export async function updateAdminUserRole(
  adminTarget: AdminUser,
  role: AdminRole,
  active: boolean,
  actor: AdminUser
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'admins', adminTarget.id), {
    role,
    active,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'audit_logs', generateDocId('aud')), {
    action: 'Updated Admin Role/Access',
    targetType: 'admin',
    targetId: adminTarget.id,
    targetLabel: adminTarget.email,
    details: `Role: ${adminTarget.role} -> ${role}, Active: ${active}`,
    actorUid: actor.uid,
    actorEmail: actor.email,
    createdAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `admins/${adminTarget.id}`);
  }
}

export async function removeAdminInvite(invite: AdminInvite, actor: AdminUser): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admin_invites', invite.id));
    await setDoc(doc(db, 'audit_logs', generateDocId('aud')), {
      action: 'Removed Admin Invite',
      targetType: 'admin_invite',
      targetId: invite.id,
      targetLabel: invite.email,
      details: `Revoked invite for ${invite.email}`,
      actorUid: actor.uid,
      actorEmail: actor.email,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admin_invites/${invite.id}`);
  }
}
