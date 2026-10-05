/**
 * Small shared building blocks in the existing Career Wave style
 * (white cards, slate text, blue-600 primary, rounded-2xl).
 */
import React, { useEffect, useState } from 'react';
import { AlertCircle, FlaskConical, RefreshCw } from 'lucide-react';
import type { AnalysisSource, Priority } from '../types';

export function ScoreRing({ score, size = 140, label = 'ATS score' }: { score: number; size?: number; label?: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#2563eb' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} ${score} out of 100`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
        <circle
          cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="transparent" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          style={{ transition: 'stroke-dashoffset 0.9s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold text-slate-900 leading-none" style={{ fontSize: size * 0.26 }}>{score}</span>
        <span className="text-[11px] text-slate-500 font-medium mt-1">/ 100</span>
      </div>
    </div>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function PriorityBadge({ priority, children }: { priority: Priority; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${PRIORITY_STYLE[priority]}`}>
      {children ?? `${priority[0].toUpperCase()}${priority.slice(1)} priority`}
    </span>
  );
}

/** Visible label whenever a result is NOT a real AI analysis of the user's data. */
export function SourceBadge({ source }: { source?: AnalysisSource }) {
  if (!source || source === 'ai') return null;
  const text = source === 'demo' ? 'Sample data — not your results' : 'Test data (mock AI)';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
      <FlaskConical className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}

export function PageHeader({ icon: Icon, title, subtitle, tone = 'blue', right }: {
  icon: React.ElementType; title: string; subtitle?: React.ReactNode; tone?: 'blue' | 'emerald' | 'purple' | 'slate'; right?: React.ReactNode;
}) {
  const tones = { blue: 'bg-blue-100 text-blue-600', emerald: 'bg-emerald-100 text-emerald-600', purple: 'bg-purple-100 text-purple-600', slate: 'bg-slate-100 text-slate-700' };
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 ${className}`}>{children}</div>;
}

/** Spinner with progress copy that advances while a long AI call runs. */
export function LoadingPanel({ messages, hint }: { messages: string[]; hint?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 6000);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <div className="py-16 text-center space-y-3" role="status" aria-live="polite">
      <div className="w-10 h-10 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin mx-auto motion-reduce:animate-none" />
      <p className="text-sm font-semibold text-slate-800">{messages[i]}</p>
      {hint && <p className="text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}

export function ErrorPanel({ message, onRetry, retryLabel = 'Try again' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3" role="alert">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-900 font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900">
            <RefreshCw className="w-3.5 h-3.5" /> {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto text-center py-16 bg-white rounded-2xl border border-slate-200 px-8 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500">{body}</p>
      {action}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children, tone = 'blue' }: { selected: boolean; onClick: () => void; children: React.ReactNode; tone?: 'blue' | 'emerald' }) {
  const on = tone === 'emerald' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-blue-600 bg-blue-600 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${selected ? on : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
    >
      {children}
    </button>
  );
}

/** Tag input used for skills and locations. */
export function TagInput({ values, onChange, placeholder, suggestions = [], tone = 'blue' }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[]; tone?: 'blue' | 'emerald';
}) {
  const [input, setInput] = useState('');
  const add = (v: string) => {
    const s = v.trim();
    if (s && !values.some((x) => x.toLowerCase() === s.toLowerCase())) onChange([...values, s]);
    setInput('');
  };
  const pill = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${pill}`}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
        }}
        onBlur={() => input && add(input)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {suggestions.filter((s) => !values.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !values.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="px-2 py-0.5 rounded-md text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
