/**
 * Career Wave — one continuous flow:
 *   Auth0 sign-in → name + target role → resume / no resume
 *   → score overview → what to improve → roadmap → jobs → alerts
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useCareerWaveApi } from './hooks/useCareerWaveApi';
import { ApiService } from './services/api';
import { CareerProvider, useCareer } from './state/CareerContext';
import { LoginView } from './components/LoginView';
import { OnboardingChoiceView } from './components/OnboardingChoiceView';
import { DashboardLayout } from './components/DashboardLayout';
import { TAB_TITLES } from './data/tabs';
import { DashboardHome } from './components/DashboardHome';
import ResumeTab from './components/ResumeTab';
import SkillAnalysisTab from './components/SkillAnalysisTab';
import LearningPathTab from './components/LearningPathTab';
import { JobMatcherTab } from './components/JobMatcherTab';
import NotificationsTab from './components/NotificationsTab';
import SettingsTab from './components/SettingsTab';
import { PrivacyModal } from './components/PrivacyModal';

function Splash({ text }: { text: string }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-sm text-slate-500" role="status">
      {text}
    </div>
  );
}

/** Active tab lives in the URL hash so a refresh keeps you on the same screen. */
function useHashTab(): [string, (tab: string) => void] {
  const read = () => {
    const t = window.location.hash.replace(/^#\/?/, '');
    return TAB_TITLES[t] ? t : 'dashboard';
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((next: string) => {
    window.location.hash = `/${next}`;
    setTab(next);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);
  return [tab, go];
}

function SignedInApp({ email, onLogout }: { email?: string; onLogout: () => void }) {
  const { state, loading, demo } = useCareer();
  const [tab, setTab] = useHashTab();
  const [reopenOnboarding, setReopenOnboarding] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (loading && !state.profile.onboardingComplete) return <Splash text="Loading your Career Wave profile…" />;

  const needsOnboarding = !state.profile.onboardingComplete || (!state.profile.path && !demo);
  if (needsOnboarding || reopenOnboarding) {
    return (
      <OnboardingChoiceView
        startAtChoice={reopenOnboarding}
        onCancel={reopenOnboarding ? () => setReopenOnboarding(false) : undefined}
        onFinished={(next) => {
          setReopenOnboarding(false);
          setTab(next);
        }}
      />
    );
  }

  const content = (() => {
    switch (tab) {
      case 'resume': return <ResumeTab onNavigate={setTab} />;
      case 'improvements': return <SkillAnalysisTab onNavigate={setTab} />;
      case 'learning-path': return <LearningPathTab onNavigate={setTab} />;
      case 'jobs': return <JobMatcherTab onNavigate={setTab} />;
      case 'notifications': return <NotificationsTab />;
      case 'settings':
        return (
          <SettingsTab
            email={email}
            onSwitchPath={() => setReopenOnboarding(true)}
            onOpenPrivacy={() => setShowPrivacy(true)}
            onSignOut={onLogout}
          />
        );
      default: return <DashboardHome onNavigate={setTab} />;
    }
  })();

  return (
    <>
      <DashboardLayout activeTab={tab} onTabChange={setTab} onLogout={onLogout} onOpenPrivacy={() => setShowPrivacy(true)}>
        {content}
      </DashboardLayout>
      {showPrivacy && (
        <PrivacyModal
          onClose={() => setShowPrivacy(false)}
          onWipeComplete={() => {
            setShowPrivacy(false);
            onLogout();
          }}
        />
      )}
    </>
  );
}

export function App() {
  const { isLoading, isAuthenticated, user, login, logout } = useCareerWaveApi();

  if (isLoading) return <Splash text="Preparing your Career Wave session…" />;
  if (!isAuthenticated) return <LoginView onLogin={login} />;

  return (
    <CareerProvider key={user?.sub} userId={user?.sub} authName={user?.name} authEmail={user?.email}>
      <SignedInApp
        email={user?.email}
        onLogout={() => {
          // Leave nothing personal in this browser after signing out.
          ApiService.clearLocalData();
          localStorage.removeItem('cw_demo_state_v2');
          void logout();
        }}
      />
    </CareerProvider>
  );
}

export default App;
