/**
 * Onboarding after Auth0 sign-in:
 *   1. Name + target role (saved to the backend, reused everywhere)
 *   2. "Do you already have a resume?"
 *   3a. I have a resume  → PathAResumeUpload  → dashboard score overview
 *   3b. I'm new          → PathBManualDetails → AI roadmap
 */
import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Pencil } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { TargetRolePicker } from './TargetRolePicker';
import { PathAResumeUpload } from './PathAResumeUpload';
import { PathBManualDetails } from './PathBManualDetails';
import { ErrorPanel, PrimaryButton } from './ui';

type Step = 'profile' | 'choice' | 'resume' | 'beginner';

interface OnboardingChoiceViewProps {
  /** Called when the user lands in the app; tab = where to go first. */
  onFinished: (tab: string) => void;
  /** Start on the choice screen (e.g. "switch path" from settings). */
  startAtChoice?: boolean;
  onCancel?: () => void;
}

export const OnboardingChoiceView: React.FC<OnboardingChoiceViewProps> = ({ onFinished, startAtChoice, onCancel }) => {
  const { state, saveProfile, suggestedName } = useCareer();
  const [step, setStep] = useState<Step>(startAtChoice || state.profile.onboardingComplete ? 'choice' : 'profile');
  const [name, setName] = useState(state.profile.name || suggestedName);
  const [role, setRole] = useState(state.profile.targetRole || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ name: name.trim(), targetRole: role.trim(), onboardingComplete: true });
      setStep('choice');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const progress = { profile: 1, choice: 2, resume: 3, beginner: 3 }[step];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200 object-contain" />
            <span className="text-base font-extrabold text-slate-900">Career Wave</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Step {progress} of 3</span>
            {onCancel && (
              <button onClick={onCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
            )}
          </div>
        </div>

        {step === 'profile' && (
          <form onSubmit={submitProfile} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Let's set up your career profile</h1>
              <p className="text-sm text-slate-500 mt-1">We use your target role to score your resume, plan what to learn and find jobs.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="cw-name" className="block text-sm font-semibold text-slate-800">Your name</label>
              <input
                id="cw-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="name"
                placeholder="e.g. Harsh Raj"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-800">What job are you targeting?</span>
              <TargetRolePicker value={role} onChange={setRole} />
              <p className="text-xs text-slate-500">You can change this later in Settings.</p>
            </div>

            {error && <ErrorPanel message={error} />}

            <PrimaryButton type="submit" disabled={saving || !name.trim() || !role.trim()} className="w-full py-3">
              {saving ? 'Saving…' : 'Continue'}
              <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </form>
        )}

        {step === 'choice' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {state.profile.name ? `${state.profile.name.split(' ')[0]}, do you already have a resume?` : 'Do you already have a resume?'}
              </h1>
              <p className="text-sm text-slate-500 inline-flex items-center gap-2">
                Target role: <span className="font-semibold text-slate-800">{state.profile.targetRole}</span>
                <button onClick={() => setStep('profile')} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold">
                  <Pencil className="w-3 h-3" /> Change
                </button>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChoiceCard
                image="/have_resume_illustration.png"
                title="I have a resume"
                body="Upload it and get your ATS score for this role, what to improve, and a roadmap."
                cta="Upload my resume"
                tone="blue"
                onClick={() => setStep('resume')}
              />
              <ChoiceCard
                image="/no_resume_illustration.png"
                title="I'm new / I don't have a resume"
                body="Tell us where you're starting from and get a step-by-step learning roadmap."
                cta="Build my roadmap"
                tone="emerald"
                onClick={() => setStep('beginner')}
              />
            </div>
          </div>
        )}

        {step === 'resume' && (
          <div className="space-y-4">
            <BackLink onClick={() => setStep('choice')} />
            <PathAResumeUpload onComplete={() => onFinished('dashboard')} />
          </div>
        )}

        {step === 'beginner' && (
          <div className="space-y-4">
            <BackLink onClick={() => setStep('choice')} />
            <PathBManualDetails onComplete={() => onFinished('learning-path')} />
          </div>
        )}
      </div>
    </div>
  );
};

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
      <ArrowLeft className="w-3.5 h-3.5" /> Back
    </button>
  );
}

function ChoiceCard({ image, title, body, cta, tone, onClick }: {
  image: string; title: string; body: string; cta: string; tone: 'blue' | 'emerald'; onClick: () => void;
}) {
  const pill = tone === 'blue' ? 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white' : 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white';
  const ring = tone === 'blue' ? 'hover:border-blue-400 focus-visible:ring-blue-500/30' : 'hover:border-emerald-400 focus-visible:ring-emerald-500/30';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group bg-white rounded-3xl p-8 border border-slate-200 text-center flex flex-col items-center shadow-sm hover:shadow-lg transition focus-visible:outline-none focus-visible:ring-4 ${ring}`}
    >
      <img src={image} alt="" className="h-32 object-contain mb-5" />
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-2 mb-6">{body}</p>
      <span className={`mt-auto inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition ${pill}`}>
        {cta} <ArrowRight className="w-4 h-4" />
      </span>
    </button>
  );
}

export default OnboardingChoiceView;
