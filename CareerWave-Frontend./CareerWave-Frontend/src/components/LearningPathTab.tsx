/**
 * Roadmap / Learning — "What should I learn, and in what order?"
 * Resume users: generated from resume + assessment (+ improvements).
 * Beginners: generated from experience level + current skills.
 * Stage completion is saved to the backend (PATCH /roadmap/progress).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, Check, Clock, ExternalLink, RefreshCw, ChevronDown, ArrowRight, Hammer, Flag, MessageSquare, Briefcase,
} from 'lucide-react';
import type { RoadmapStage } from '../types';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { PathBManualDetails } from './PathBManualDetails';
import { Card, ErrorPanel, LoadingPanel, PageHeader, PriorityBadge, SourceBadge } from './ui';

export default function LearningPathTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state, generateRoadmap, setStageComplete } = useCareer();
  const { roadmap, roadmapProgress, profile, resume } = state;
  const isResumeUser = profile.path === 'resume' && Boolean(resume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const autoRan = useRef(false);

  const regenerate = async () => {
    if (!isResumeUser) {
      setEditingStart(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await generateRoadmap({ mode: 'resume' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Resume users arrive here from "Want a roadmap?" — generate once automatically.
  useEffect(() => {
    if (isResumeUser && !roadmap && !autoRan.current) {
      autoRan.current = true;
      regenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResumeUser, roadmap]);

  useEffect(() => {
    if (roadmap && !open) setOpen(roadmap.stages.find((s) => !roadmapProgress[s.id])?.id ?? null);
  }, [roadmap, roadmapProgress, open]);

  const header = (
    <PageHeader
      icon={GraduationCap}
      tone="emerald"
      title="Your roadmap"
      subtitle={<>What to learn, in order, to become ready for <span className="font-semibold text-slate-700">{profile.targetRole}</span></>}
      right={roadmap && !busy && !editingStart ? (
        <button onClick={regenerate} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200">
          <RefreshCw className="w-3.5 h-3.5" /> {isResumeUser ? 'Regenerate' : 'Update my starting point'}
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
            messages={['Looking at what your resume already proves…', 'Ordering the skills you still need…', 'Adding projects, resources and interview prep…']}
            hint="Your personalised roadmap usually takes under a minute."
          />
        </Card>
      </div>
    );
  }

  if ((!roadmap && !isResumeUser) || editingStart) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {header}
        <PathBManualDetails onComplete={() => setEditingStart(false)} />
        {editingStart && (
          <button onClick={() => setEditingStart(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
        )}
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {header}
        {error ? <ErrorPanel message={error} onRetry={regenerate} /> : null}
      </div>
    );
  }

  const done = roadmap.stages.filter((s) => roadmapProgress[s.id]).length;
  const pct = Math.round((done / Math.max(1, roadmap.stages.length)) * 100);
  const hoursLeft = roadmap.stages.filter((s) => !roadmapProgress[s.id]).reduce((sum, s) => sum + s.estimatedHours, 0);
  const stale = roadmap.targetRole !== profile.targetRole;

  const toggle = async (stage: RoadmapStage) => {
    try {
      await setStageComplete(stage.id, !roadmapProgress[stage.id]);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {header}
      {error && <ErrorPanel message={error} />}
      {stale && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-900">This roadmap is for {roadmap.targetRole}. Your target is now {profile.targetRole}.</p>
          <button onClick={regenerate} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold">Rebuild roadmap</button>
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 max-w-2xl">
            <p className="text-base text-slate-800">{roadmap.summary}</p>
            <p className="text-sm text-slate-500"><span className="font-semibold text-slate-700">Starting point:</span> {roadmap.startingPoint}</p>
          </div>
          <SourceBadge source={roadmap.source} />
        </div>
        <div>
          <div className="flex justify-between text-sm text-slate-600 mb-1.5 flex-wrap gap-2">
            <span className="font-semibold text-slate-800">{done} of {roadmap.stages.length} stages complete</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {hoursLeft ? `≈ ${hoursLeft} hours left` : ''} {roadmap.totalEstimatedTime && `· ${roadmap.totalEstimatedTime}`}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <ol className="relative space-y-4">
        <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-slate-200" aria-hidden />
        {roadmap.stages.map((stage) => {
          const complete = Boolean(roadmapProgress[stage.id]);
          const expanded = open === stage.id;
          return (
            <li key={stage.id} className="relative pl-14">
              <button
                onClick={() => toggle(stage)}
                aria-label={complete ? `Mark stage ${stage.order} as not done` : `Mark stage ${stage.order} as done`}
                className={`absolute left-0 top-4 w-10 h-10 rounded-full flex items-center justify-center z-10 font-bold text-sm transition ${
                  complete ? 'bg-emerald-500 text-white ring-4 ring-emerald-100' : 'bg-white border-2 border-slate-300 text-slate-600 hover:border-emerald-500'
                }`}
              >
                {complete ? <Check className="w-5 h-5" /> : stage.order}
              </button>
              <div className={`rounded-2xl border bg-white ${complete ? 'border-emerald-200' : 'border-slate-200'}`}>
                <button
                  onClick={() => setOpen(expanded ? null : stage.id)}
                  aria-expanded={expanded}
                  className="w-full text-left p-4 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-base font-bold ${complete ? 'text-emerald-900' : 'text-slate-900'}`}>{stage.title}</h3>
                      {!complete && <PriorityBadge priority={stage.priority} />}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {stage.estimatedTime}{stage.estimatedHours ? ` · ~${stage.estimatedHours} h` : ''}</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <StageDetail stage={stage} complete={complete} onToggle={() => toggle(stage)} />}
              </div>
            </li>
          );
        })}
      </ol>

      {(roadmap.interviewPrep.topics.length > 0 || roadmap.readinessMilestones.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roadmap.readinessMilestones.length > 0 && (
            <Card>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Flag className="w-4 h-4 text-emerald-600" /> You're job-ready when…</h3>
              <ul className="space-y-2 text-sm">
                {roadmap.readinessMilestones.map((m) => (
                  <li key={m.title}><span className="font-semibold text-slate-800">{m.title}</span>{m.criteria && <span className="text-slate-600"> — {m.criteria}</span>}</li>
                ))}
              </ul>
            </Card>
          )}
          {roadmap.interviewPrep.topics.length > 0 && (
            <Card>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4 text-blue-600" /> Interview preparation</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {roadmap.interviewPrep.topics.map((t) => <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-xs text-slate-700">{t}</span>)}
              </div>
              <ul className="space-y-1 text-sm text-slate-600 list-disc pl-5">
                {roadmap.interviewPrep.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}

      {roadmap.generalTips.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Tips for {roadmap.targetRole}</h3>
          <ul className="space-y-1 text-sm text-slate-600 list-disc pl-5">{roadmap.generalTips.map((t) => <li key={t}>{t}</li>)}</ul>
        </Card>
      )}

      <section className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">Start looking for jobs</h2>
          <p className="text-sm text-slate-300 mt-1">Tell us where and what kind of work you want — we'll match real openings to your profile.</p>
        </div>
        <button onClick={() => onNavigate('jobs')} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 flex-shrink-0">
          <Briefcase className="w-4 h-4" /> Set up job search <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}

function StageDetail({ stage, complete, onToggle }: { stage: RoadmapStage; complete: boolean; onToggle: () => void }) {
  return (
    <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4 text-sm">
      {stage.reason && <p className="text-slate-700"><span className="font-semibold text-slate-900">Why: </span>{stage.reason}</p>}
      {stage.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stage.skills.map((s) => <span key={s} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">{s}</span>)}
        </div>
      )}
      {stage.topics.length > 0 && (
        <div>
          <div className="font-semibold text-slate-900 mb-1">Topics</div>
          <ul className="list-disc pl-5 text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-x-6">{stage.topics.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {stage.prerequisites.length > 0 && <p className="text-slate-600"><span className="font-semibold text-slate-900">Before this: </span>{stage.prerequisites.join(', ')}</p>}
      {stage.expectedOutcome && <p className="text-slate-600"><span className="font-semibold text-slate-900">You'll be able to: </span>{stage.expectedOutcome}</p>}
      {stage.projects.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5"><Hammer className="w-4 h-4 text-slate-500" /> Build</div>
          {stage.projects.map((p) => (
            <div key={p.title} className="rounded-xl bg-slate-50 p-3"><span className="font-semibold text-slate-800">{p.title}</span>{p.description && <span className="text-slate-600"> — {p.description}</span>}</div>
          ))}
        </div>
      )}
      {stage.resources.length > 0 && (
        <div>
          <div className="font-semibold text-slate-900 mb-2">Resources</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stage.resources.map((r) => (
              <li key={r.title} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{r.type}</span>
                  <div className="text-slate-800 font-semibold mt-1">{r.title}</div>
                  {r.provider && <div className="text-xs text-slate-500">{r.provider}</div>}
                </div>
                <a
                  href={r.url ?? `https://www.google.com/search?q=${encodeURIComponent(`${r.title} ${r.provider ?? ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                  aria-label={r.url ? `Open ${r.title}` : `Search for ${r.title}`}
                  title={r.url ? 'Open' : 'Search for this resource'}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        {stage.milestone && <p className="text-slate-600"><span className="font-semibold text-slate-900">Done when: </span>{stage.milestone}</p>}
        <button
          onClick={onToggle}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${complete ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
        >
          {complete ? 'Mark as not done' : 'Mark stage complete'}
        </button>
      </div>
    </div>
  );
}
