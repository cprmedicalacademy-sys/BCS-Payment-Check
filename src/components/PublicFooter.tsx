import React, { useState } from 'react';
import { Mail, MapPin, Phone, X } from 'lucide-react';
import { AcademySettings } from '../types/portal';
import { PublicRoute } from './PublicHeader';

interface PublicFooterProps {
  settings: AcademySettings;
  onNavigate: (route: PublicRoute, sectionId?: string) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ settings, onNavigate }) => {
  const [modalDoc, setModalDoc] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="border-t border-slate-200 bg-[#0B1F3A] text-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-5 space-y-3">
              <p className="font-display text-lg font-bold text-white">
                {settings.academyName}
              </p>
              <p className="text-sm text-teal-300 font-medium">{settings.tagline}</p>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">
                Official BCS Batch Student Verification, Payment Clearance, and Subject Final / Grand Mock Examination update portal.
              </p>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-sm">
              <p className="font-semibold text-white">Academic Office Contact</p>
              <div className="flex items-start gap-2.5 text-slate-300">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                <span className="tabular-nums">{settings.contactPhone}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-300">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                <span>{settings.contactEmail}</span>
              </div>
              <div className="flex items-start gap-2.5 text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                <span>{settings.officeAddress}</span>
              </div>
              <p className="text-xs text-slate-400 pt-1">{settings.officeHours}</p>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-sm">
              <p className="font-semibold text-white">Portal Navigation</p>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('landing', 'register-section')}
                    className="hover:text-white transition-colors"
                  >
                    Student Verification Form
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('status')}
                    className="hover:text-white transition-colors"
                  >
                    Check Application Status
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('exams')}
                    className="hover:text-white transition-colors"
                  >
                    Subject Final & Grand Mock Portal
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalDoc('privacy')}
                    className="hover:text-white transition-colors"
                  >
                    Privacy Notice
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setModalDoc('terms')}
                    className="hover:text-white transition-colors"
                  >
                    Verification Terms
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} {settings.academyName}. All rights reserved.
            </p>
            <p>
              Office-verified manual approval required for WhatsApp group & restricted exam access.
            </p>
          </div>
        </div>
      </footer>

      {modalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F3A]/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                {modalDoc === 'privacy' ? 'Privacy Notice' : 'Verification Policy & Terms'}
              </h3>
              <button
                type="button"
                onClick={() => setModalDoc(null)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {modalDoc === 'privacy' ? settings.privacyPolicy : settings.termsText}
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setModalDoc(null)}
                className="rounded-md bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#16345C]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
