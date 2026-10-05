/**
 * Path B — no resume / beginner. Collects starting level, current skills and
 * optional background, then asks the AI agent for a roadmap. No ATS score is
 * produced for these users.
 */
import React, { useState } from 'react';
import { GraduationCap, ArrowRight, ChevronDown } from 'lucide-react';
import { useCareer } from '../state/CareerContext';
import { errorMessage } from '../services/api';
import { EXPERIENCE_LEVELS, POPULAR_SKILLS } from '../data/options';
import { ErrorPanel, LoadingPanel, TagInput } from './ui';

export const PathBManualDetails: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { state, generateRoadmap } = useCareer();
  const p = state.profile;
  const [level, setLevel] = useState(p.experienceLevel && EXPERIENCE_LEVELS.some((l) => l.value === p.experienceLevel) ? p.experienceLevel : 'Beginner / Student');
  const [skills, setSkills] = useState<string[]>(p.currentSkills || []);
  const [showMore, setShowMore] = useState(Boolean(p.education || p.background));
  const [degree, setDegree] = useState(p.education?.degree || '');
  const [institution, setInstitution] = useState(p.education?.institution || '');
  const [gradYear, setGradYear] = useState(p.education?.graduationYear || '');
  const [background, setBackground] = useState(p.background || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateRoadmap({
        mode: 'beginner',
        targetRole: p.targetRole,
        experienceLevel: level,
        skills,
        education: degree || institution ? { degree: degree || null, institution: institution || null, graduationYear: gradYear || null } : null,
        background: background.trim() || null,
      });
      onComplete();
    } catch (e) {
      setError(errorMessage(e, 'We could not build your roadmap. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm">
        <LoadingPanel
          messages={[`Planning your path to ${p.targetRole}…`, 'Ordering skills so each builds on the last…', 'Adding projects and interview preparation…']}
          hint="Your AI career roadmap usually takes under a minute."
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Where are you starting from?</h1>
        <p className="text-sm text-slate-500 mt-1">
          We'll build a roadmap to <span className="font-semibold text-slate-800">{p.targetRole}</span> from your current level.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 mb-2">Your experience level</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXPERIENCE_LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setLevel(l.value)}
              className={`p-3 rounded-xl border text-left transition ${level === l.value ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className={`text-sm font-semibold ${level === l.value ? 'text-emerald-800' : 'text-slate-800'}`}>{l.value}</div>
              <div className="text-xs text-slate-500">{l.hint}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <span className="block text-sm font-semibold text-slate-800">What do you already know? <span className="font-normal text-slate-500">(optional)</span></span>
        <TagInput values={skills} onChange={setSkills} placeholder="Type a skill and press Enter" suggestions={POPULAR_SKILLS} tone="emerald" />
      </div>

      <div>
        <button type="button" onClick={() => setShowMore(!showMore)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900" aria-expanded={showMore}>
          <ChevronDown className={`w-3.5 h-3.5 transition ${showMore ? 'rotate-180' : ''}`} />
          Add education or background (optional)
        </button>
        {showMore && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="Degree, e.g. B.Tech CSE" aria-label="Degree" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="College / school" aria-label="Institution" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <input value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="Graduation year" aria-label="Graduation year" inputMode="numeric" className="px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Anything else? e.g. switching from mechanical engineering, 10 hrs/week to study"
              aria-label="Background"
              className="sm:col-span-3 px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
          </div>
        )}
      </div>

      {error && <ErrorPanel message={error} onRetry={submit} />}

      <button
        type="button"
        onClick={submit}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition"
      >
        <GraduationCap className="w-5 h-5" /> Build my roadmap <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default PathBManualDetails;
