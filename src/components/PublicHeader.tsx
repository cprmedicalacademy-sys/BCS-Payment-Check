import React, { useState } from 'react';
import { Menu, Shield, X } from 'lucide-react';
import { AcademySettings, DEFAULT_LOGO_PATH } from '../types/portal';

export type PublicRoute = 'landing' | 'status' | 'exams' | 'admin';

interface PublicHeaderProps {
  activeRoute: PublicRoute;
  onNavigate: (route: PublicRoute, sectionId?: string) => void;
  settings: AcademySettings;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  activeRoute,
  onNavigate,
  settings,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const navItems: Array<{ label: string; route: PublicRoute; sectionId?: string }> = [
    { label: 'Register', route: 'landing', sectionId: 'register-section' },
    { label: 'Status Check', route: 'status' },
    { label: 'Exam Portal', route: 'exams' },
    { label: 'Notices', route: 'landing', sectionId: 'public-notices-section' },
  ];

  const handleLinkClick = (route: PublicRoute, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(route, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('landing')}
          className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[#1D5FA7] whitespace-nowrap shrink-0"
        >
          {!imgError && (settings.logoUrl || DEFAULT_LOGO_PATH) ? (
            <img
              src={settings.logoUrl || DEFAULT_LOGO_PATH}
              alt={`${settings.academyName} crest`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-9 w-9 rounded object-cover border border-slate-200 bg-white shrink-0"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#0B1F3A] text-white shrink-0">
              <Shield className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
          <span className="font-display text-base font-bold tracking-tight text-[#0B1F3A] sm:text-lg whitespace-nowrap shrink-0">
            {settings.academyName}
          </span>
        </button>

        {/* Zone 2: 4 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive =
              activeRoute === item.route &&
              (item.route !== 'landing' || item.sectionId === 'register-section');
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.route, item.sectionId)}
                className={`text-sm font-medium transition-colors hover:text-[#1D5FA7] whitespace-nowrap shrink-0 underline-offset-8 ${
                  isActive ? 'text-[#0B1F3A] underline decoration-2 decoration-[#1D5FA7]' : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('admin')}
            className="hidden sm:inline-flex items-center justify-center rounded-md bg-[#0B1F3A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#16345C] focus-visible:outline-2 focus-visible:outline-[#1D5FA7] whitespace-nowrap shrink-0"
          >
            Admin Portal
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.route, item.sectionId)}
                className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#1D5FA7]"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleLinkClick('admin')}
              className="mt-2 flex min-h-[44px] items-center justify-center rounded-md bg-[#0B1F3A] px-4 text-sm font-semibold text-white"
            >
              Admin Portal
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
