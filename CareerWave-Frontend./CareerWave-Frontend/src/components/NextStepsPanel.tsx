/** Shared "what's next" strip: job preferences + alerts setup, shown on both dashboards. */
import React from 'react';
import { Briefcase, Bell, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCareer } from '../state/CareerContext';

export function NextStepsPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state } = useCareer();
  const js = state.preferences.jobSearch;
  const n = state.preferences.notifications;
  const jobsDone = Boolean(js.updatedAt);
  const alertsDone = n.enabled;
  const items = [
    {
      tab: 'jobs', icon: Briefcase, done: jobsDone,
      title: jobsDone ? 'Job search is set up' : 'Set your job search preferences',
      body: jobsDone ? `${js.jobTypes.join(', ') || 'Any type'} · ${js.locations.join(', ') || 'Anywhere'}` : 'Choose where you want to work and what type of job you want.',
    },
    {
      tab: 'notifications', icon: Bell, done: alertsDone,
      title: alertsDone ? `Job alerts on ${n.channel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}` : 'Get job alerts on WhatsApp or Telegram',
      body: alertsDone ? `${n.frequency === 'daily' ? 'Daily' : 'Weekly'} matches for your role.` : 'Optional. We only message you after you turn it on.',
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((it) => (
        <button
          key={it.tab}
          onClick={() => onNavigate(it.tab)}
          className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-sm transition flex items-start gap-3 group"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${it.done ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
            {it.done ? <CheckCircle2 className="w-5 h-5" /> : <it.icon className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-900">{it.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{it.body}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 mt-1" />
        </button>
      ))}
    </div>
  );
}
