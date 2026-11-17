import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  Hash,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  AcademySettings,
  BatchItem,
  EXAM_HALL_IMAGE,
  ExamNotice,
  HERO_LECTURE_IMAGE,
  Language,
} from '../types/portal';
import {
  checkDuplicateRegNo,
  StudentRegistrationReceipt,
  submitStudentRegistration,
} from '../services/portalService';
import { buildWhatsAppLink, validateWhatsAppPhone } from '../lib/crypto';
import { PublicRoute } from './PublicHeader';

interface LandingPageProps {
  settings: AcademySettings;
  batches: BatchItem[];
  publicNotices: ExamNotice[];
  onNavigate: (route: PublicRoute, sectionId?: string) => void;
  initialFocusSection?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  settings,
  batches,
  publicNotices,
  onNavigate,
  initialFocusSection,
}) => {
  const [lang, setLang] = useState<Language>('bn');
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [examImgErr, setExamImgErr] = useState(false);

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [bcsRegNo, setBcsRegNo] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [batchId, setBatchId] = useState(batches[0]?.id || 'cpr-special-bcs-online');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicateAlert, setDuplicateAlert] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [receipt, setReceipt] = useState<StudentRegistrationReceipt | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regSpinKey, setRegSpinKey] = useState(0);

  // Live Admission Form Completion & 8-Digit Reg Breakdown
  const isNameValid = fullName.trim().length >= 2;
  const isPhoneValid = validateWhatsAppPhone(whatsappNumber);
  const cleanRegDigits = bcsRegNo.trim().replace(/\D/g, '');
  const isRegValid = /^\d{8}$/.test(cleanRegDigits);
  const isBatchValid = Boolean(batchId);
  const completedStepsCount =
    (isNameValid ? 1 : 0) +
    (isPhoneValid ? 1 : 0) +
    (isRegValid ? 1 : 0) +
    (isBatchValid && consentAccepted ? 1 : 0);
  const formProgress = completedStepsCount / 4;

  const currentYearTwo = new Date().getFullYear().toString().slice(-2);
  const phoneDigitsOnly = whatsappNumber.replace(/\D/g, '');
  const phoneLastThree = phoneDigitsOnly.length >= 3 ? phoneDigitsOnly.slice(-3) : '---';

  useEffect(() => {
    if (batches.length > 0 && !batches.some((b) => b.id === batchId)) {
      setBatchId(batches[0].id);
    }
  }, [batches, batchId]);

  useEffect(() => {
    if (initialFocusSection) {
      const el = document.getElementById(initialFocusSection);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }
  }, [initialFocusSection]);

  const handleRegBlur = async () => {
    if (!/^\d{8}$/.test(bcsRegNo.trim())) return;
    try {
      const exists = await checkDuplicateRegNo(bcsRegNo);
      setDuplicateAlert(exists);
    } catch {
      // Ignore transient lookup error on blur
    }
  };

  const handleAutoBuildRegNo = () => {
    const phoneDigits = whatsappNumber.replace(/\D/g, '');
    if (phoneDigits.length < 3) {
      setFieldErrors((prev) => ({
        ...prev,
        whatsappNumber:
          'রেজিস্ট্রেশন নম্বর তৈরি করতে প্রথমে আপনার WhatsApp নম্বর লিখুন। Enter your WhatsApp number first.',
      }));
      return;
    }
    const yearTwo = new Date().getFullYear().toString().slice(-2);
    const lastThree = phoneDigits.slice(-3);
    const customThree = String(Math.floor(100 + Math.random() * 900));
    const generated = `${yearTwo}${lastThree}${customThree}`;
    setBcsRegNo(generated);
    setRegSpinKey((k) => k + 1);
    setDuplicateAlert(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.bcsRegNo;
      delete next.whatsappNumber;
      return next;
    });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (fullName.trim().length < 2) {
      errors.fullName =
        'অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন (কমপক্ষে ২ অক্ষর)। Please enter your full name.';
    }

    const cleanReg = bcsRegNo.trim().replace(/\D/g, '');
    if (!/^\d{8}$/.test(cleanReg)) {
      errors.bcsRegNo =
        '৮ ডিজিটের সঠিক BCS Registration Number দিন (বছর ২ ডিজিট + মোবাইলের শেষ ৩ ডিজিট + ৩ ডিজিট, যেমন: 26133362)। Enter a valid 8-digit numeric Registration Number.';
    }

    if (!validateWhatsAppPhone(whatsappNumber)) {
      errors.whatsappNumber =
        'সঠিক WhatsApp মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX বা +88017XXXXXXXX)। Enter a valid WhatsApp number.';
    }

    if (!batchId) {
      errors.batchId = 'অনুগ্রহ করে আপনার ব্যাচ নির্বাচন করুন। Please select your batch.';
    }

    if (!consentAccepted) {
      errors.consentAccepted =
        'তথ্য সঠিক মর্মে সম্মতি বক্সে টিক দিন। Please confirm that your submitted details are accurate.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setDuplicateAlert(false);

    if (!validateForm()) return;

    const selectedBatch = batches.find((b) => b.id === batchId) || batches[0];
    setSubmitting(true);

    try {
      const res = await submitStudentRegistration({
        fullName: fullName.trim(),
        bcsRegNo: bcsRegNo.trim().replace(/\D/g, ''),
        whatsappNumber: whatsappNumber.trim(),
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        consentAccepted: true,
      });
      setReceipt(res);
      setFullName('');
      setBcsRegNo('');
      setWhatsappNumber('');
      setConsentAccepted(false);
      setFieldErrors({});
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_REG_NO') {
        setDuplicateAlert(true);
        setSubmitError(
          'এই BCS Registration Number দিয়ে ইতোমধ্যে একটি আবেদন জমা রয়েছে। অনুগ্রহ করে Status Check পেজে আপনার কোড ব্যবহার করুন অথবা CPR অফিসে যোগাযোগ করুন।'
        );
      } else if (err?.message === 'INVALID_REG_NO') {
        setFieldErrors((prev) => ({
          ...prev,
          bcsRegNo:
            '৮ ডিজিটের সঠিক BCS Registration Number লিখুন (যেমন: 26133362)। Enter an 8-digit numeric Registration Number.',
        }));
      } else {
        setSubmitError(
          'আবেদন জমা দিতে সমস্যা হয়েছে। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন অথবা অফিসে যোগাযোগ করুন।'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!receipt) return;
    const text = `CPR Medical Academy Verification Receipt\nApplication ID: ${receipt.applicationId}\nBCS Reg No: ${receipt.bcsRegNo}\nVerification Code: ${receipt.verificationCode}`;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const steps = [
    {
      num: '01.',
      title: lang === 'bn' ? 'তথ্য জমা দিন' : 'Submit Registration',
      desc:
        lang === 'bn'
          ? 'নাম, BCS Registration Number, WhatsApp ও ব্যাচের তথ্য সঠিকভাবে জমা দিন।'
          : 'Provide your full name, unique BCS registration number, WhatsApp number, and batch.',
    },
    {
      num: '02.',
      title: lang === 'bn' ? 'অফিস যাচাইকরণ' : 'Manual Identity Review',
      desc:
        lang === 'bn'
          ? 'CPR Medical Academy অফিস আপনার পরিচয় ও ব্যাচের রেকর্ড ম্যানুয়ালি যাচাই করবে।'
          : 'Our academic office verifies your candidate identity and batch enrollment record.',
    },
    {
      num: '03.',
      title: lang === 'bn' ? 'পেমেন্ট ক্লিয়ারেন্স' : 'Payment Clearance',
      desc:
        lang === 'bn'
          ? 'বকেয়া বা কোর্স ফি যাচাই সম্পন্ন হলে আপনার স্ট্যাটাস Payment Verified হবে।'
          : 'Office confirms tuition fee settlement or outstanding balance clearance manually.',
    },
    {
      num: '04.',
      title: lang === 'bn' ? 'WhatsApp ও পরীক্ষার তথ্য' : 'WhatsApp & Exam Access',
      desc:
        lang === 'bn'
          ? 'অনুমোদিত শিক্ষার্থীদের অফিসিয়াল WhatsApp Group এবং Subject Final ও Grand Mock রেজাল্টে যুক্ত করা হবে।'
          : 'Approved candidates are added to the official WhatsApp group and unlock restricted results.',
    },
  ];

  return (
    <div className="bg-[#F8FAFC]">
      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {/* Language & Tagline Toolbar */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>{settings.academyName}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#0F766E]">{settings.tagline}</span>
            </div>

            <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'bn'
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'en'
                    ? 'bg-[#0B1F3A] text-white'
                    : 'text-slate-600 hover:text-[#0B1F3A]'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* 2-Column Hero Split */}
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-between space-y-8 lg:col-span-6">
              <div className="space-y-5">
                <p className="text-xs font-semibold tracking-wide text-[#1D5FA7]">
                  BCS Batch Student Verification
                </p>
                <h1
                  className="font-display font-bold tracking-tight text-[#0B1F3A]"
                  style={{
                    fontSize: 'clamp(2.1rem, 3.6vw, 3.2rem)',
                    lineHeight: 1.12,
                    textWrap: 'balance',
                  }}
                >
                  BCS Batch Student Verification Portal
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
                  {lang === 'bn'
                    ? 'Subject Final ও Grand Mock Exam-এর ফলাফল এবং সকল গুরুত্বপূর্ণ তথ্য পেতে আপনার তথ্য জমা দিন।'
                    : 'Submit your verified BCS candidate information for office review to receive Subject Final and Grand Mock Exam results, routines, and official WhatsApp group updates.'}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('register-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#1D5FA7] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#164A84] focus-visible:outline-2 focus-visible:outline-[#1D5FA7] whitespace-nowrap shrink-0"
                  >
                    <span>
                      {lang === 'bn' ? 'ভেরিফিকেশন ফর্ম পূরণ করুন' : 'Submit Verification Form'}
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('status')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#0B1F3A] transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <span>
                      {lang === 'bn' ? 'আবেদনের অবস্থা দেখুন' : 'Check Application Status'}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>Manual Office Verification</span>
                  <span aria-hidden="true">·</span>
                  <span>Unique BCS Registration Check</span>
                  <span aria-hidden="true">·</span>
                  <span>Approved-Only Result Access</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[280px] overflow-hidden rounded-lg border border-slate-200 bg-[#0B1F3A]">
                {!heroImgErr ? (
                  <img
                    src={HERO_LECTURE_IMAGE}
                    alt="CPR Medical Academy BCS study hall and exam preparation center"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgErr(true)}
                    className="h-full w-full object-cover lg:h-full"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center text-white">
                    <BookOpen className="mb-3 h-10 w-10 text-teal-300" aria-hidden="true" />
                    <p className="font-display text-lg font-semibold">{settings.academyName}</p>
                    <p className="mt-1 text-sm text-slate-300">{settings.tagline}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B1F3A]/90 via-[#0B1F3A]/55 to-transparent p-6">
                  <p className="text-xs font-medium text-teal-300">
                    {settings.academyName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {settings.tagline}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Process Strip below hero split */}
          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.num} className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-[#1D5FA7] tabular-nums">
                    {step.num}
                  </span>
                  <h2 className="font-display text-sm font-bold text-[#0B1F3A]">
                    {step.title}
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content: Official Instructions + Student Registration Form */}
      <section id="register-section" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* Left Column: Instructions, Notice & Policy */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-7 space-y-5">
              <div className="flex items-center gap-2.5 text-[#0B1F3A]">
                <Info className="h-5 w-5 text-[#1D5FA7] shrink-0" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold">
                  {lang === 'bn' ? 'গুরুত্বপূর্ণ নির্দেশনা' : 'Official Verification Instructions'}
                </h2>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-slate-700">
                <p>{settings.banglaInstruction}</p>
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-4 text-amber-950">
                  <p className="font-semibold text-xs text-amber-900 mb-1">
                    {lang === 'bn' ? 'অফিসিয়াল নোটিশ' : 'Important Notice'}
                  </p>
                  <p className="text-sm leading-relaxed">{settings.banglaNotice}</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5 space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-4 w-4 text-[#0F766E] shrink-0" aria-hidden="true" />
                  <p>
                    <strong className="text-[#0B1F3A]">Mandatory Admin Approval:</strong> Submitting this form does not automatically grant access to the WhatsApp group or exam results. Office staff manually verify identity and payment clearance first.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[#1D5FA7] shrink-0" aria-hidden="true" />
                  <p>
                    <strong className="text-[#0B1F3A]">Privacy Assurance:</strong> Your WhatsApp number and payment details are visible only to authorized CPR Medical Academy administrators.
                  </p>
                </div>
              </div>
            </div>

            {/* Office Support Card */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
              <h3 className="font-display text-sm font-bold text-[#0B1F3A]">
                {lang === 'bn' ? 'পেমেন্ট বা রেজিস্ট্রেশন সহায়তা' : 'Office Contact & Payment Support'}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600">
                {lang === 'bn'
                  ? 'পেমেন্ট বকেয়া বা তথ্য সংশোধনের প্রয়োজনে অফিস সময়ে নিচের নম্বরে যোগাযোগ করুন।'
                  : 'For payment clearance inquiries or registration corrections, contact the academic office.'}
              </p>
              <div className="space-y-2 pt-1 text-xs text-slate-700">
                <p className="flex items-center gap-2 font-mono tabular-nums">
                  <Phone className="h-3.5 w-3.5 text-[#1D5FA7]" aria-hidden="true" />
                  <span>{settings.contactPhone}</span>
                </p>
                <p className="text-slate-500">{settings.officeAddress}</p>
                <p className="text-slate-500">{settings.officeHours}</p>
                <div className="pt-1">
                  <a
                    href={buildWhatsAppLink(
                      settings.officeWhatsapp,
                      'Assalamu Alaikum, I am contacting CPR Medical Academy office regarding BCS Student Verification.'
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-[#0F766E] bg-[#F0FDFA] px-3.5 py-2 text-xs font-semibold text-[#0F766E] transition-colors hover:bg-[#CCFBF1]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>WhatsApp Office ({settings.contactPhone})</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Animated Admission Form OR Post-Submission Receipt */}
          <div className="lg:col-span-7">
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait">
                {receipt ? (
                  <motion.div
                    key="submission-receipt"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-lg border border-[#99F6E4] bg-white p-6 sm:p-8 space-y-6 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]"
                      >
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      </motion.div>
                      <div>
                        <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                          আবেদন সফলভাবে জমা হয়েছে · Verification Submitted
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          আপনার তথ্য CPR Medical Academy-তে জমা হয়েছে। অফিস থেকে পরিচয় ও পেমেন্ট যাচাই করার পর আপনাকে WhatsApp Group-এ যুক্ত করা হবে।
                        </p>
                      </div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-md border border-slate-200 bg-slate-50 p-5 space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-500">Application / Reference ID</p>
                          <p className="mt-0.5 font-mono text-base font-semibold text-[#0B1F3A] tabular-nums">
                            {receipt.applicationId}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Secure Verification Code (Save This)</p>
                          <p className="mt-0.5 font-mono text-base font-bold text-[#1D5FA7] tabular-nums">
                            {receipt.verificationCode}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Candidate Name</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{receipt.fullName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">BCS Registration Number</p>
                          <p className="mt-0.5 font-mono text-sm font-medium text-slate-900 tabular-nums">
                            {receipt.bcsRegNo}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-amber-800 font-medium">
                          স্ট্যাটাস চেক করতে আপনার BCS Registration Number ও Verification Code সংরক্ষণ করুন।
                        </p>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={copyCredentials}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#0F766E]" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy Receipt</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>

                    <div className="rounded-md border border-slate-200 bg-[#EFF6FF]/60 p-4 text-xs leading-relaxed text-slate-700">
                      <strong>Important:</strong> Submitting this form sets your status to{' '}
                      <span className="font-mono font-semibold">Submitted</span> and payment status to{' '}
                      <span className="font-mono font-semibold">Pending</span>. Access to the official WhatsApp group and restricted exam results is granted only after manual office approval.
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-md border border-[#99F6E4] bg-[#F0FDFA] p-4 space-y-3"
                    >
                      <p className="text-xs font-semibold text-[#0F766E]">
                        সরাসরি অফিসের WhatsApp-এ আপনার তথ্য পাঠান ({settings.contactPhone})
                      </p>
                      <p className="text-xs text-slate-700">
                        নিচের বাটনে ক্লিক করলে আপনার নাম, BCS Registration Number ও Application ID সহ সরাসরি অফিসের WhatsApp নাম্বারে চলে যাবে।
                      </p>
                      <motion.a
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        href={buildWhatsAppLink(
                          settings.officeWhatsapp,
                          `Assalamu Alaikum CPR Medical Academy,\nI have submitted my BCS Batch Student Verification form.\n\nApplication ID: ${receipt.applicationId}\nName: ${receipt.fullName}\nBCS Reg No: ${receipt.bcsRegNo}\nWhatsApp: ${receipt.whatsappNumber}\nBatch: ${receipt.batchName}\n\nPlease verify my details and payment.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0D625B] sm:w-auto"
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>WhatsApp-এ সরাসরি পাঠান ({settings.contactPhone})</span>
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </motion.a>
                    </motion.div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <motion.button
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate('status')}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#1D5FA7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164A84] whitespace-nowrap shrink-0"
                      >
                        <span>Go to Status Check</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setReceipt(null)}
                        className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        Submit Another Candidate
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="admission-form"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handleSubmit}
                    noValidate
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  >
                    {/* Animated Live Completion Progress Rail */}
                    <div className="h-1 w-full bg-slate-100 overflow-hidden" aria-hidden="true">
                      <motion.div
                        className="h-full w-full bg-gradient-to-r from-[#1D5FA7] to-[#0F766E]"
                        style={{ transformOrigin: 'left' }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: formProgress }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>

                    <div className="p-6 sm:p-8 space-y-6">
                      {/* Header & Step Progress Strip */}
                      <div className="border-b border-slate-200 pb-5 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                              {lang === 'bn'
                                ? 'শিক্ষার্থী ভর্তি ও তথ্য যাচাইকরণ ফর্ম'
                                : 'BCS Student Admission & Verification Form'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                              {lang === 'bn'
                                ? 'সকল (*) চিহ্নিত ঘর সঠিকভাবে পূরণ করুন। প্রতিটি BCS Registration Number কেবল একবার জমা দেওয়া যাবে।'
                                : 'Complete all required fields accurately. Each BCS Registration Number can only be registered once.'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-xs font-semibold text-[#0B1F3A] tabular-nums">
                              {completedStepsCount}/4
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {lang === 'bn' ? 'ধাপ সম্পন্ন' : 'Completed'}
                            </p>
                          </div>
                        </div>

                        {/* Interactive 4-Step Checklist */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { label: lang === 'bn' ? '১. পূর্ণ নাম' : '1. Full Name', done: isNameValid },
                            { label: lang === 'bn' ? '২. WhatsApp' : '2. WhatsApp', done: isPhoneValid },
                            { label: lang === 'bn' ? '৩. রেজি. নম্বর' : '3. 8-Digit Reg', done: isRegValid },
                            { label: lang === 'bn' ? '৪. ব্যাচ ও সম্মতি' : '4. Batch & Consent', done: isBatchValid && consentAccepted },
                          ].map((stepItem) => (
                            <div
                              key={stepItem.label}
                              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                                stepItem.done
                                  ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E] font-medium'
                                  : 'border-slate-200 bg-slate-50/70 text-slate-500'
                              }`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors ${
                                  stepItem.done ? 'bg-[#0F766E] text-white' : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                <AnimatePresence mode="wait">
                                  {stepItem.done ? (
                                    <motion.span
                                      key="check"
                                      initial={{ scale: 0.4, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0.4, opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                    >
                                      <Check className="h-3 w-3" strokeWidth={3} />
                                    </motion.span>
                                  ) : (
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  )}
                                </AnimatePresence>
                              </span>
                              <span className="truncate">{stepItem.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <AnimatePresence>
                        {duplicateAlert && (
                          <motion.div
                            key="duplicate-alert"
                            role="alert"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-2.5"
                          >
                            <div className="flex items-start gap-2.5">
                              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700 shrink-0" aria-hidden="true" />
                              <div>
                                <p className="font-semibold">
                                  এই BCS Registration Number-টি ইতোমধ্যে নিবন্ধিত রয়েছে (Duplicate Registration Detected)
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-amber-900">
                                  আপনি ইতোপূর্বে তথ্য জমা দিয়ে থাকলে আপনার Verification Code দিয়ে Status Check পেজ থেকে বর্তমান অবস্থা দেখুন বা তথ্য সংশোধনের অনুরোধ পাঠান। কোড হারিয়ে গেলে অফিসে যোগাযোগ করুন।
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 pl-7">
                              <button
                                type="button"
                                onClick={() => onNavigate('status')}
                                className="rounded-md bg-[#0B1F3A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#16345C]"
                              >
                                Check Status / Request Correction
                              </button>
                              <a
                                href={buildWhatsAppLink(
                                  settings.officeWhatsapp,
                                  `Assalamu Alaikum, I need help with my duplicate BCS registration number: ${bcsRegNo}`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                              >
                                Contact CPR Office
                              </a>
                            </div>
                          </motion.div>
                        )}

                        {submitError && !duplicateAlert && (
                          <motion.div
                            key="submit-error"
                            role="alert"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                          >
                            <AlertCircle className="mt-0.5 h-5 w-5 text-red-700 shrink-0" aria-hidden="true" />
                            <span>{submitError}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="space-y-5">
                        {/* Full Name */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="fullName"
                              className="block text-sm font-medium text-[#0B1F3A]"
                            >
                              Full Name (পূর্ণ নাম) <span className="text-red-600">*</span>
                            </label>
                            <AnimatePresence>
                              {isNameValid && (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ duration: 0.15 }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F766E]"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Valid</span>
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="relative mt-1.5">
                            <User
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="fullName"
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => {
                                setFullName(e.target.value);
                                if (fieldErrors.fullName) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.fullName;
                                    return next;
                                  });
                                }
                              }}
                              placeholder="Dr. Md. Ashraful Islam"
                              maxLength={140}
                              className={`block w-full rounded-md border bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                                fieldErrors.fullName
                                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                                  : isNameValid
                                  ? 'border-[#0F766E]/60 focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                                  : 'border-slate-300 focus:border-[#1D5FA7] focus:ring-[#1D5FA7]/20'
                              }`}
                            />
                          </div>
                          <AnimatePresence>
                            {fieldErrors.fullName && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16 }}
                                className="mt-1.5 text-xs text-red-700"
                              >
                                {fieldErrors.fullName}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* WhatsApp & 8-Digit BCS Reg No */}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="whatsappNumber"
                                className="block text-sm font-medium text-[#0B1F3A]"
                              >
                                WhatsApp Number <span className="text-red-600">*</span>
                              </label>
                              <AnimatePresence>
                                {isPhoneValid && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F766E]"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Valid</span>
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                            <div className="relative mt-1.5">
                              <Phone
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                              />
                              <input
                                id="whatsappNumber"
                                type="tel"
                                required
                                value={whatsappNumber}
                                onChange={(e) => {
                                  setWhatsappNumber(e.target.value);
                                  if (fieldErrors.whatsappNumber) {
                                    setFieldErrors((prev) => {
                                      const next = { ...prev };
                                      delete next.whatsappNumber;
                                      return next;
                                    });
                                  }
                                }}
                                placeholder="018XXXXXXXX"
                                maxLength={24}
                                className={`block w-full rounded-md border bg-white pl-10 pr-4 py-2.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                                  fieldErrors.whatsappNumber
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                                    : isPhoneValid
                                    ? 'border-[#0F766E]/60 focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                                    : 'border-slate-300 focus:border-[#1D5FA7] focus:ring-[#1D5FA7]/20'
                                }`}
                              />
                            </div>
                            <AnimatePresence mode="wait">
                              {fieldErrors.whatsappNumber ? (
                                <motion.p
                                  key="wa-err"
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="mt-1.5 text-xs text-red-700"
                                >
                                  {fieldErrors.whatsappNumber}
                                </motion.p>
                              ) : (
                                <p className="mt-1.5 text-[11px] text-slate-500">
                                  মোবাইলের শেষ ৩ ডিজিট (<span className="font-mono font-semibold text-[#0B1F3A]">{phoneLastThree}</span>) রেজিস্ট্রেশন নম্বরে ব্যবহৃত হবে।
                                </p>
                              )}
                            </AnimatePresence>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="bcsRegNo"
                                className="block text-sm font-medium text-[#0B1F3A]"
                              >
                                BCS Reg. No (8 Digits) <span className="text-red-600">*</span>
                              </label>
                              <motion.button
                                type="button"
                                whileTap={{ scale: 0.94 }}
                                onClick={handleAutoBuildRegNo}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#1D5FA7] hover:bg-[#EFF6FF] transition-colors whitespace-nowrap shrink-0"
                              >
                                <motion.span
                                  key={regSpinKey}
                                  initial={{ rotate: 0 }}
                                  animate={{ rotate: regSpinKey > 0 ? 180 : 0 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                </motion.span>
                                <span>Auto-fill (তৈরি করুন)</span>
                              </motion.button>
                            </div>
                            <div className="relative mt-1.5">
                              <Hash
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                aria-hidden="true"
                              />
                              <input
                                id="bcsRegNo"
                                type="text"
                                inputMode="numeric"
                                required
                                value={bcsRegNo}
                                onChange={(e) => {
                                  setBcsRegNo(e.target.value.replace(/\D/g, '').slice(0, 8));
                                  setDuplicateAlert(false);
                                  if (fieldErrors.bcsRegNo) {
                                    setFieldErrors((prev) => {
                                      const next = { ...prev };
                                      delete next.bcsRegNo;
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={handleRegBlur}
                                placeholder="e.g. 26133362"
                                maxLength={8}
                                className={`block w-full rounded-md border bg-white pl-10 pr-14 py-2.5 font-mono text-sm tracking-wider text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
                                  fieldErrors.bcsRegNo
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                                    : isRegValid
                                    ? 'border-[#0F766E]/60 focus:border-[#0F766E] focus:ring-[#0F766E]/20'
                                    : 'border-slate-300 focus:border-[#1D5FA7] focus:ring-[#1D5FA7]/20'
                                }`}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-400 tabular-nums">
                                {cleanRegDigits.length}/8
                              </span>
                            </div>

                            {/* Live 8-Digit Structure Breakdown */}
                            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                              <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <p className="text-[10px] text-slate-500">বছর (২)</p>
                                <p className="font-mono text-xs font-semibold text-[#0B1F3A] tabular-nums">
                                  {cleanRegDigits.slice(0, 2) || currentYearTwo}
                                </p>
                              </div>
                              <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <p className="text-[10px] text-slate-500">মোবাইল শেষ ৩</p>
                                <p className="font-mono text-xs font-semibold text-[#1D5FA7] tabular-nums">
                                  {cleanRegDigits.slice(2, 5) || phoneLastThree}
                                </p>
                              </div>
                              <div className="rounded border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <p className="text-[10px] text-slate-500">পছন্দের ৩</p>
                                <p className="font-mono text-xs font-semibold text-[#0F766E] tabular-nums">
                                  {cleanRegDigits.slice(5, 8) || '---'}
                                </p>
                              </div>
                            </div>

                            <AnimatePresence>
                              {fieldErrors.bcsRegNo && (
                                <motion.p
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.16 }}
                                  className="mt-1.5 text-xs text-red-700"
                                >
                                  {fieldErrors.bcsRegNo}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Interactive Batch Selection Cards */}
                        <div>
                          <label
                            id="batch-selection-label"
                            className="block text-sm font-medium text-[#0B1F3A]"
                          >
                            Batch Selection (ব্যাচ নির্বাচন) <span className="text-red-600">*</span>
                          </label>
                          <div
                            role="radiogroup"
                            aria-labelledby="batch-selection-label"
                            className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                          >
                            {batches.map((b) => {
                              const isSelected = batchId === b.id;
                              return (
                                <motion.button
                                  key={b.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.985 }}
                                  transition={{ duration: 0.14 }}
                                  onClick={() => {
                                    setBatchId(b.id);
                                    if (fieldErrors.batchId) {
                                      setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next.batchId;
                                        return next;
                                      });
                                    }
                                  }}
                                  className={`relative flex items-start justify-between gap-2 rounded-md border p-3 text-left transition-colors duration-150 ${
                                    isSelected
                                      ? 'border-[#1D5FA7] bg-[#EFF6FF]/70 text-[#0B1F3A]'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <GraduationCap
                                        className={`h-3.5 w-3.5 shrink-0 ${
                                          isSelected ? 'text-[#1D5FA7]' : 'text-slate-400'
                                        }`}
                                        aria-hidden="true"
                                      />
                                      <span className="text-xs font-semibold leading-snug">
                                        {b.name}
                                      </span>
                                    </div>
                                    {b.description && (
                                      <p className="text-[11px] leading-snug text-slate-500 line-clamp-2">
                                        {b.description}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                      isSelected
                                        ? 'border-[#1D5FA7] bg-[#1D5FA7] text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && (
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ duration: 0.14 }}
                                      >
                                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                                      </motion.span>
                                    )}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                          <AnimatePresence>
                            {fieldErrors.batchId && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16 }}
                                className="mt-1.5 text-xs text-red-700"
                              >
                                {fieldErrors.batchId}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Animated Consent Checkbox Card */}
                        <motion.div
                          animate={{
                            backgroundColor: consentAccepted ? '#F0FDFA' : '#F8FAFC',
                            borderColor: fieldErrors.consentAccepted
                              ? '#F87171'
                              : consentAccepted
                              ? '#99F6E4'
                              : '#E2E8F0',
                          }}
                          transition={{ duration: 0.18 }}
                          className="rounded-md border p-4"
                        >
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={consentAccepted}
                              onChange={(e) => {
                                setConsentAccepted(e.target.checked);
                                if (fieldErrors.consentAccepted) {
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.consentAccepted;
                                    return next;
                                  });
                                }
                              }}
                              className="sr-only"
                            />
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                                consentAccepted
                                  ? 'border-[#0F766E] bg-[#0F766E] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                                <motion.path
                                  d="M2.5 7.5L5.5 10.5L11.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  initial={false}
                                  animate={{ pathLength: consentAccepted ? 1 : 0, opacity: consentAccepted ? 1 : 0 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                />
                              </svg>
                            </span>
                            <span className="text-xs leading-relaxed text-slate-700">
                              আমি নিশ্চিত করছি যে প্রদত্ত নাম, BCS Registration Number, WhatsApp Number ও ব্যাচের তথ্য সম্পূর্ণ সঠিক। অফিস থেকে পরিচয় ও পেমেন্ট যাচাই সম্পন্ন হওয়ার পর আমাকে অফিসিয়াল WhatsApp Group-এ যুক্ত করা হবে। (I confirm all submitted information is accurate and understand admin approval is mandatory.)
                            </span>
                          </label>
                          <AnimatePresence>
                            {fieldErrors.consentAccepted && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16 }}
                                className="mt-2 text-xs text-red-700"
                              >
                                {fieldErrors.consentAccepted}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                          All submissions enter manual review queue immediately.
                        </p>
                        <motion.button
                          type="submit"
                          disabled={submitting}
                          whileHover={submitting ? undefined : { y: -1 }}
                          whileTap={submitting ? undefined : { scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#1D5FA7] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#164A84] disabled:opacity-60 whitespace-nowrap shrink-0"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Verification Information</span>
                              <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </MotionConfig>
          </div>
        </div>
      </section>

      {/* Public Exam Announcements & Overview */}
      <section
        id="public-notices-section"
        className="border-t border-slate-200 bg-white py-12 lg:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 h-full min-h-[240px]">
                {!examImgErr ? (
                  <img
                    src={EXAM_HALL_IMAGE}
                    alt="Subject Final and Grand Mock medical examination preparation materials"
                    referrerPolicy="no-referrer"
                    onError={() => setExamImgErr(true)}
                    className="h-full w-full object-cover lg:h-full"
                  />
                ) : (
                  <div className="flex h-full min-h-[240px] items-center justify-center p-6 text-slate-500">
                    <FileText className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#1D5FA7]">
                    Public Academic Notices
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-[#0B1F3A]">
                    Subject Final & Grand Mock Exam Updates
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('exams')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D5FA7] hover:text-[#164A84] whitespace-nowrap shrink-0"
                >
                  <span>Open Exam & Result Portal</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {publicNotices.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                  No public announcements posted yet. Approved students can check restricted exam schedules and published results inside the Exam Portal.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  {publicNotices.map((notice) => (
                    <article key={notice.id} className="py-4 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-[#0F766E]">{notice.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{notice.batchName}</span>
                        {notice.examDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Calendar className="h-3 w-3" aria-hidden="true" />
                              {notice.examDate}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                        {notice.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600">{notice.summary}</p>
                    </article>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span>
                  Restricted exam routines and published merit lists are accessible exclusively to approved students.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('status')}
                  className="font-semibold text-[#0B1F3A] underline underline-offset-4 hover:text-[#1D5FA7] whitespace-nowrap shrink-0"
                >
                  Verify your eligibility
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
