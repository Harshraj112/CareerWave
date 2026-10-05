import React, { useEffect, useState } from 'react';
import {
  Home, FileText, Lightbulb, GraduationCap, Briefcase, Bell, Settings, ShieldCheck, Menu, LogOut, FlaskConical, X, Target,
} from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { TAB_TITLES } from '../data/tabs';

interface DashboardLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onOpenPrivacy: () => void;
  children: React.ReactNode;
}

interface NavItem { id: string; label: string; icon: React.ElementType; done?: boolean }


export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ activeTab, onTabChange, onLogout, onOpenPrivacy, children }) => {
  const { state, backend, demo, exitDemo } = useCareer();
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isResume = state.profile.path === 'resume' && Boolean(state.resume);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const nav: NavItem[] = isResume
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'resume', label: 'Resume', icon: FileText },
        { id: 'improvements', label: 'Improvement Analysis', icon: Lightbulb, done: Boolean(state.improvements) },
        { id: 'learning-path', label: 'Roadmap', icon: GraduationCap, done: Boolean(state.roadmap) },
        { id: 'jobs', label: 'Jobs', icon: Briefcase, done: Boolean(state.preferences.jobSearch.updatedAt) },
        { id: 'notifications', label: 'Job Alerts', icon: Bell, done: state.preferences.notifications.enabled },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'learning-path', label: 'Roadmap & Learning', icon: GraduationCap, done: Boolean(state.roadmap) },
        { id: 'jobs', label: 'Jobs', icon: Briefcase, done: Boolean(state.preferences.jobSearch.updatedAt) },
        { id: 'notifications', label: 'Job Alerts', icon: Bell, done: state.preferences.notifications.enabled },
      ];

  const displayName = state.profile.name || 'Your profile';
  const initials = (state.profile.name || '?').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  const go = (tab: string) => { onTabChange(tab); setMobileOpen(false); };
  const expanded = wide || mobileOpen;


  return (
    <div className="flex h-screen bg-[#f4f7fb] text-slate-900 font-sans overflow-hidden">
      {mobileOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`${expanded ? 'w-64' : 'w-20'} ${mobileOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'relative hidden sm:flex'} bg-[#111928] text-slate-300 flex-col flex-shrink-0 transition-all duration-300`}
      >
        <button onClick={() => go('dashboard')} className="px-5 py-4 border-b border-slate-800/80 flex items-center gap-3 text-left hover:bg-slate-800/30">
          <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="Career Wave" className="w-full h-full object-contain" />
          </div>
          {expanded && (
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white leading-tight">Career Wave</div>
              <p className="text-[11px] text-slate-400 truncate">Your Path to Opportunity</p>
            </div>
          )}
        </button>

        {expanded && state.profile.targetRole && (
          <button onClick={() => go('settings')} className="mx-3.5 mt-4 px-3 py-2.5 rounded-xl bg-slate-800/60 text-left hover:bg-slate-800">
            <div className="text-[11px] text-slate-400">Target role</div>
            <div className="text-sm font-semibold text-white flex items-center gap-1.5 truncate"><Target className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />{state.profile.targetRole}</div>
          </button>
        )}

        <nav className="flex-1 px-3.5 py-4 overflow-y-auto space-y-1" aria-label="Main">
          {nav.map((item) => <NavButton key={item.id} item={item} active={activeTab === item.id} expanded={expanded} onClick={() => go(item.id)} />)}
          {expanded && <div className="pt-6 pb-2 px-3 text-[11px] font-semibold text-slate-500">More</div>}
          {!isResume && <NavButton item={{ id: 'resume', label: 'Add a resume', icon: FileText }} active={activeTab === 'resume'} expanded={expanded} onClick={() => go('resume')} />}
          <NavButton item={{ id: 'settings', label: 'Settings', icon: Settings }} active={activeTab === 'settings'} expanded={expanded} onClick={() => go('settings')} />
          <button onClick={onOpenPrivacy} title="Privacy" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />{expanded && <span>Privacy & data</span>}
          </button>
        </nav>

        <div className="p-3.5 border-t border-slate-800/80">
          <button onClick={onLogout} className="w-full py-2 px-3 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg flex items-center justify-center gap-2">
            <LogOut className="w-3.5 h-3.5" />{expanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100" aria-label="Open menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-base font-bold text-slate-900">{TAB_TITLES[activeTab] || 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {backend === 'offline' && !demo && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800" role="status">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Offline — showing saved data
              </span>
            )}
            <button onClick={() => go('settings')} className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-slate-100">
              <span className="w-8 h-8 rounded-full bg-[#5b21b6] text-white flex items-center justify-center font-bold text-xs">{initials}</span>
              <span className="text-sm font-semibold text-slate-800 hidden sm:inline">{displayName}</span>
            </button>
          </div>
        </header>

        {demo && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-sm text-amber-950">
            <span className="flex items-center gap-2"><FlaskConical className="w-4 h-4" /> You're viewing a sample resume. These results are not about you.</span>
            <button onClick={() => exitDemo().then(() => go('resume'))} className="font-semibold underline whitespace-nowrap">Upload my resume</button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
};

function NavButton({ item, active, expanded, onClick }: { item: NavItem; active: boolean; expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
        active ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <item.icon className="w-5 h-5 flex-shrink-0" />
        {expanded && <span className="truncate">{item.label}</span>}
      </span>
      {expanded && item.done && !active && <span className="w-2 h-2 rounded-full bg-emerald-400" aria-label="done" />}
    </button>
  );
}
