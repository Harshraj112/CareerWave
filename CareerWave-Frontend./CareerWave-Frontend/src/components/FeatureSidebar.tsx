import React, { useEffect, useState } from 'react';
import {
  FileText,
  Target,
  Gauge,
  GraduationCap,
  Briefcase,
  Bell,
  ShieldCheck
} from 'lucide-react';

interface FeatureSidebarProps {
  onOpenPrivacy: () => void;
}

// Each item maps 1:1 to a module from the system design (§3.1–§3.7).
// `id` matches an element id placed in ProgressiveFlow so we can jump to it.
const FEATURES = [
  { id: 'feature-resume-choice', label: 'Resume Parser', desc: 'Upload & extract', icon: FileText },
  { id: 'feature-role-profile', label: 'Role Profiles', desc: 'Target role skills', icon: Target },
  { id: 'feature-scoring', label: 'Scoring / Gap Engine', desc: 'Match & gap analysis', icon: Gauge },
  { id: 'feature-learning-path', label: 'Learning Path', desc: 'Curated resources', icon: GraduationCap },
  { id: 'feature-job-matcher', label: 'Job Matcher', desc: 'Ranked openings', icon: Briefcase },
  { id: 'feature-notifications', label: 'Notifications', desc: 'Digest alerts', icon: Bell },
] as const;

export const FeatureSidebar: React.FC<FeatureSidebarProps> = ({ onOpenPrivacy }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  // Lightweight scroll-spy: highlight whichever section is currently nearest the top.
  useEffect(() => {
    const onScroll = () => {
      let closestId: string | null = null;
      let closestDist = Infinity;
      for (const f of FEATURES) {
        const el = document.getElementById(f.id);
        if (!el) continue;
        const dist = Math.abs(el.getBoundingClientRect().top - 120);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = f.id;
        }
      }
      setActiveId(closestId);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 sticky top-20 self-start h-[calc(100vh-6rem)] pr-2">
      <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-3 mb-2">
        Features
      </div>
      <nav className="space-y-1">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const isActive = activeId === f.id;
          const exists = typeof document !== 'undefined' && !!document.getElementById(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => goTo(f.id)}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left transition ${
                isActive
                  ? 'bg-stone-900 text-white shadow-xs'
                  : exists
                  ? 'text-stone-700 hover:bg-stone-100'
                  : 'text-stone-400'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-300' : 'text-stone-400'}`} />
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{f.label}</div>
                <div className={`text-[11px] truncate ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>
                  {f.desc}
                </div>
              </div>
            </button>
          );
        })}

        {/* Storage & Deletion doesn't have a scroll target — it opens the Privacy modal directly */}
        <button
          type="button"
          onClick={onOpenPrivacy}
          className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-stone-700 hover:bg-stone-100 transition"
        >
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-stone-400" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">Storage & Deletion</div>
            <div className="text-[11px] truncate text-stone-400">Wipe your data</div>
          </div>
        </button>
      </nav>
    </aside>
  );
};
