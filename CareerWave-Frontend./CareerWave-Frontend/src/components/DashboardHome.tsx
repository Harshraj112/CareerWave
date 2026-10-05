/**
 * Dashboard — the first screen after onboarding.
 *   Resume user:  target role + ATS score + interpretation + strengths/weaknesses
 *                 → full breakdown → "Want to know what to improve?"
 *   Beginner:     starting point + roadmap progress → continue learning
 * Both:          job search + alerts setup.
 */
import React, { useState } from 'react';
import { ArrowRight, Target, ThumbsUp, ThumbsDown, RefreshCw, GraduationCap, FileText, Sparkles } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { AssessmentDashboard } from './AssessmentDashboard';
import { NextStepsPanel } from './NextStepsPanel';
import { Card, ErrorPanel, LoadingPanel, PrimaryButton, ScoreRing, SourceBadge } from './ui';

interface DashboardHomeProps {
  onNavigate: (tab: string) => void;
}

const LABEL_STYLE: Record<string, string> = {
  Strong: 'bg-emerald-100 text-emerald-800',
  Competitive: 'bg-blue-100 text-blue-800',
  Developing: 'bg-amber-100 text-amber-800',
  'Needs work': 'bg-red-100 text-red-700',
};

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate }) => {
  const { state } = useCareer();
  if (state.profile.path === 'resume' && state.resume) return <ResumeOverview onNavigate={onNavigate} />;
  return <BeginnerOverview onNavigate={onNavigate} />;
};

function ResumeOverview({ onNavigate }: DashboardHomeProps) {
  const { state, runAssessment } = useCareer();
  const { assessment: a, profile } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rescore = async () => {
    setBusy(true);
    setError(null);
    try {
      await runAssessment();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Card className="max-w-3xl mx-auto">
        <LoadingPanel messages={[`Scoring your resume for ${profile.targetRole}…`, 'Comparing your skills with what employers ask for…']} />
      </Card>
    );
  }

  if (!a) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Your resume is uploaded but not scored yet</h2>
          <p className="text-sm text-slate-500">Score it for {profile.targetRole} to see your ATS score and gaps.</p>
          <PrimaryButton onClick={rescore}>Score my resume</PrimaryButton>
        </Card>
        {error && <ErrorPanel message={error} onRetry={rescore} />}
      </div>
    );
  }

  const stale = a.targetRole !== profile.targetRole;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {stale && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-amber-900">
            Your target role is now <strong>{profile.targetRole}</strong>, but this score is for <strong>{a.targetRole}</strong>.
          </p>
          <button onClick={rescore} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700">
            <RefreshCw className="w-3.5 h-3.5" /> Re-score for {profile.targetRole}
          </button>
        </div>
      )}
      {error && <ErrorPanel message={error} onRetry={rescore} />}

      {/* Hero: role + score + interpretation */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <ScoreRing score={a.atsScore} size={168} />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <Target className="w-4 h-4 text-blue-600" /> {a.targetRole}
              </span>
              <SourceBadge source={a.source} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 flex-wrap">
              ATS score {a.atsScore}/100
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${LABEL_STYLE[a.scoreLabel] || 'bg-slate-100 text-slate-700'}`}>{a.scoreLabel}</span>
            </h1>
            <p className="text-base text-slate-700 leading-relaxed max-w-2xl">{a.interpretation}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4">
            <h2 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-2"><ThumbsUp className="w-4 h-4" /> Main strengths</h2>
            <ul className="space-y-1.5 text-sm text-emerald-950 list-disc pl-5">
              {a.strengths.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl bg-red-50/70 border border-red-100 p-4">
            <h2 className="text-sm font-bold text-red-900 flex items-center gap-2 mb-2"><ThumbsDown className="w-4 h-4" /> Main gaps</h2>
            <ul className="space-y-1.5 text-sm text-red-950 list-disc pl-5">
              {a.weaknesses.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <AssessmentDashboard assessment={a} />

      {/* CTA → improvement analysis */}
      <section className="rounded-3xl bg-blue-600 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-blue-600/20">
        <div>
          <h2 className="text-xl font-extrabold">Want to know what to improve?</h2>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            Get a detailed analysis of each problem in your resume — why it matters, how to fix it and what to do first.
          </p>
        </div>
        <button
          onClick={() => onNavigate('improvements')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition flex-shrink-0"
        >
          Show me what to improve <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <NextStepsPanel onNavigate={onNavigate} />
    </div>
  );
}

function BeginnerOverview({ onNavigate }: DashboardHomeProps) {
  const { state } = useCareer();
  const { roadmap, roadmapProgress, profile } = state;
  const total = roadmap?.stages.length || 0;
  const done = roadmap ? roadmap.stages.filter((s) => roadmapProgress[s.id]).length : 0;
  const hoursLeft = roadmap ? roadmap.stages.filter((s) => !roadmapProgress[s.id]).reduce((sum, s) => sum + s.estimatedHours, 0) : 0;
  const next = roadmap?.stages.find((s) => !roadmapProgress[s.id]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 flex-wrap">
          <Target className="w-4 h-4 text-emerald-600" /> Your path to {profile.targetRole}
          <SourceBadge source={roadmap?.source} />
        </div>
        {roadmap ? (
          <>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {done === total && total > 0 ? 'Roadmap complete — time to apply' : `Stage ${done + 1} of ${total}: ${next?.title ?? ''}`}
            </h1>
            <p className="text-base text-slate-700 max-w-2xl">{roadmap.startingPoint}</p>
            <div>
              <div className="flex justify-between text-sm text-slate-600 mb-1.5">
                <span>{done} of {total} stages complete</span>
                <span>{hoursLeft > 0 ? `≈ ${hoursLeft} study hours left` : roadmap.totalEstimatedTime}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button
              onClick={() => onNavigate('learning-path')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
            >
              <GraduationCap className="w-4 h-4" /> {done ? 'Continue my roadmap' : 'Open my roadmap'} <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Let's plan what to learn</h1>
            <p className="text-base text-slate-700">Tell us your starting point and our AI will build a step-by-step roadmap to {profile.targetRole}.</p>
            <button onClick={() => onNavigate('learning-path')} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm">
              <Sparkles className="w-4 h-4" /> Build my roadmap
            </button>
          </>
        )}
      </section>

      <NextStepsPanel onNavigate={onNavigate} />

      <button onClick={() => onNavigate('resume')} className="w-full text-left bg-white rounded-2xl border border-dashed border-slate-300 p-5 hover:border-blue-400 transition flex items-center gap-3">
        <FileText className="w-5 h-5 text-slate-500" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">Built a resume while learning?</div>
          <div className="text-xs text-slate-500">Upload it to get your ATS score for {profile.targetRole}.</div>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

export default DashboardHome;
