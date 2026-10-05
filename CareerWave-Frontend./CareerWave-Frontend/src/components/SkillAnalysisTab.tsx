/**
 * Improvement Analysis — "What should I improve?"
 * AI-generated from the parsed resume + target role + assessment. Grouped by
 * category; each item explains the problem, why it matters, how to fix it,
 * the missing evidence and its priority. Ends with "Want a roadmap?".
 */
import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, ArrowRight, RefreshCw, Map, FileText, Wrench, Info, Zap } from 'lucide-react';
import type { ImprovementItem, Priority } from '../types';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { IMPROVEMENT_CATEGORY_LABELS } from '../data/options';
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader, PriorityBadge, PrimaryButton, SourceBadge } from './ui';

interface Props {
  onNavigate: (tab: string) => void;
}

export default function SkillAnalysisTab({ onNavigate }: Props) {
  const { state, generateImprovements } = useCareer();
  const { improvements, resume, profile } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Priority>('all');
  const autoRan = useRef(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateImprovements();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Arriving here (via "Want to know what to improve?") starts the analysis once.
  useEffect(() => {
    if (resume && !improvements && !autoRan.current) {
      autoRan.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, improvements]);

  if (!resume) {
    return (
      <EmptyState
        icon={FileText}
        title="Upload a resume to see what to improve"
        body="The improvement analysis reads your actual resume and compares it with what employers expect for your target role."
        action={<PrimaryButton onClick={() => onNavigate('resume')}>Upload resume</PrimaryButton>}
      />
    );
  }

  const header = (
    <PageHeader
      icon={Lightbulb}
      tone="purple"
      title="What to improve"
      subtitle={<>Personalised for <span className="font-semibold text-slate-700">{profile.targetRole}</span></>}
      right={improvements && !busy ? (
        <button onClick={run} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200">
          <RefreshCw className="w-3.5 h-3.5" /> Re-analyse
        </button>
      ) : undefined}
    />
  );

  if (busy) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {header}
        <Card>
          <LoadingPanel
            messages={['Reading every section of your resume…', `Comparing it with ${profile.targetRole} expectations…`, 'Writing specific fixes for each problem…']}
            hint="Detailed analysis takes up to a minute."
          />
        </Card>
      </div>
    );
  }

  if (!improvements) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {header}
        {error ? <ErrorPanel message={error} onRetry={run} /> : <PrimaryButton onClick={run}>Analyse my resume</PrimaryButton>}
      </div>
    );
  }

  const stale = improvements.targetRole !== profile.targetRole;
  const items = improvements.items.filter((i) => filter === 'all' || i.priority === filter);
  const grouped = items.reduce<Record<string, ImprovementItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});
  const counts = { high: 0, medium: 0, low: 0 } as Record<Priority, number>;
  improvements.items.forEach((i) => counts[i.priority]++);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {header}
      {error && <ErrorPanel message={error} onRetry={run} />}
      {stale && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-900">This analysis was written for {improvements.targetRole}. Your target is now {profile.targetRole}.</p>
          <button onClick={run} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold">Re-analyse</button>
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <p className="text-base text-slate-800 leading-relaxed max-w-2xl">{improvements.summary}</p>
          <SourceBadge source={improvements.source} />
        </div>
        {improvements.priorities.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Do these first</h3>
            <ol className="space-y-2">
              {improvements.priorities.map((p, i) => (
                <li key={p} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="pt-0.5">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by priority">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {f === 'all' ? `All (${improvements.items.length})` : `${f[0].toUpperCase()}${f.slice(1)} (${counts[f]})`}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500">{IMPROVEMENT_CATEGORY_LABELS[cat] || cat}</h3>
          {list.map((it) => <ImprovementCard key={it.id} item={it} />)}
        </section>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">No items with this priority.</p>}

      <section className="rounded-3xl bg-emerald-600 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-emerald-600/20">
        <div>
          <h2 className="text-xl font-extrabold">Want a roadmap?</h2>
          <p className="text-sm text-emerald-50 mt-1 max-w-xl">
            Get a step-by-step plan of what to learn, in what order, to close these gaps and become ready for {profile.targetRole}.
          </p>
        </div>
        <button
          onClick={() => onNavigate('learning-path')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-700 font-bold text-sm hover:bg-emerald-50 flex-shrink-0"
        >
          <Map className="w-4 h-4" /> Build my roadmap <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}

function ImprovementCard({ item }: { item: ImprovementItem }) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-bold text-slate-900">{item.problem}</h4>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="text-sm text-slate-700">{item.explanation}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-slate-500" /> Why it matters</dt>
          <dd className="text-slate-600 mt-1">{item.impact}</dd>
        </div>
        <div className="rounded-xl bg-blue-50/60 p-3">
          <dt className="font-semibold text-blue-900 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> How to fix it</dt>
          <dd className="text-blue-950/80 mt-1">{item.fix}</dd>
        </div>
      </dl>
      {item.missingEvidence && (
        <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Missing evidence:</span> {item.missingEvidence}</p>
      )}
      {item.example && (
        <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
          <div className="p-3 bg-red-50/50"><span className="font-semibold text-red-800">Before: </span><span className="text-slate-700">{item.example.before}</span></div>
          <div className="p-3 bg-emerald-50/50 border-t border-slate-200"><span className="font-semibold text-emerald-800">After: </span><span className="text-slate-700">{item.example.after}</span></div>
        </div>
      )}
      {item.suggestedAction && (
        <p className="text-sm font-semibold text-slate-900 flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> {item.suggestedAction}
        </p>
      )}
    </article>
  );
}
