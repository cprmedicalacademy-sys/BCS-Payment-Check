import { useCallback, useEffect, useState } from 'react';
import {
  AcademySettings,
  BatchItem,
  DEFAULT_ACADEMY_SETTINGS,
  DEFAULT_BATCHES,
  ExamNotice,
  StudentStatusToken,
} from './types/portal';
import {
  fetchAcademySettings,
  fetchActiveBatches,
  fetchPublicExamNotices,
} from './services/portalService';
import { PublicHeader, PublicRoute } from './components/PublicHeader';
import { PublicFooter } from './components/PublicFooter';
import { LandingPage } from './components/LandingPage';
import { StatusCheckPage } from './components/StatusCheckPage';
import { ExamPortalPage } from './components/ExamPortalPage';
import { AdminDashboard } from './components/AdminDashboard';

function getInitialRoute(): PublicRoute {
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/status')) return 'status';
  if (path.startsWith('/exams')) return 'exams';
  return 'landing';
}

export default function App() {
  const [route, setRoute] = useState<PublicRoute>(getInitialRoute);
  const [focusSection, setFocusSection] = useState<string | undefined>();

  const [settings, setSettings] = useState<AcademySettings>(DEFAULT_ACADEMY_SETTINGS);
  const [batches, setBatches] = useState<BatchItem[]>(DEFAULT_BATCHES);
  const [publicNotices, setPublicNotices] = useState<ExamNotice[]>([]);

  const [unlockedPortalKey, setUnlockedPortalKey] = useState('');
  const [unlockedStudent, setUnlockedStudent] = useState<StudentStatusToken | null>(null);

  const loadPublicData = useCallback(async () => {
    try {
      const [s, b, n] = await Promise.all([
        fetchAcademySettings(),
        fetchActiveBatches(),
        fetchPublicExamNotices().catch(() => []),
      ]);
      setSettings(s);
      setBatches(b);
      setPublicNotices(n);
    } catch {
      // Fallback defaults remain active
    }
  }, []);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(getInitialRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextRoute: PublicRoute, sectionId?: string) => {
    setRoute(nextRoute);
    setFocusSection(sectionId);
    const targetPath =
      nextRoute === 'landing' ? '/' : `/${nextRoute}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleUnlockExamPortal = (portalKey: string, student: StudentStatusToken) => {
    setUnlockedPortalKey(portalKey);
    setUnlockedStudent(student);
    navigate('exams');
  };

  if (route === 'admin') {
    return (
      <AdminDashboard
        academySettings={settings}
        onExitToPublic={() => navigate('landing')}
        onSettingsChanged={loadPublicData}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <PublicHeader activeRoute={route} onNavigate={navigate} settings={settings} />

      <main className="flex-1">
        {route === 'landing' && (
          <LandingPage
            settings={settings}
            batches={batches}
            publicNotices={publicNotices}
            onNavigate={navigate}
            initialFocusSection={focusSection}
          />
        )}

        {route === 'status' && (
          <StatusCheckPage
            settings={settings}
            batches={batches}
            onUnlockExamPortal={handleUnlockExamPortal}
            onNavigate={navigate}
          />
        )}

        {route === 'exams' && (
          <ExamPortalPage
            publicNotices={publicNotices}
            unlockedPortalKey={unlockedPortalKey}
            unlockedStudent={unlockedStudent}
            onUnlock={(key, stu) => {
              setUnlockedPortalKey(key);
              setUnlockedStudent(stu);
            }}
            onNavigate={navigate}
          />
        )}
      </main>

      <PublicFooter settings={settings} onNavigate={navigate} />
    </div>
  );
}
