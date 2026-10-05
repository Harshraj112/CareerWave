/**
 * Jobs — job search preferences + matching jobs from the web-parsing catalog
 * (backend GET /jobs, ranked by role, location, job type, skills and level).
 * Sample listings are shown only in demo mode, clearly labelled.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, MapPin, ExternalLink, Search, Clock, ShieldCheck, Bell, ArrowRight, RefreshCw } from 'lucide-react';
import type { JobSearchResult, JobType } from '../types';
import { useCareer } from '../state/CareerContext';
import { ApiService, errorMessage } from '../services/api';
import { demoJobs } from '../services/demoEngine';
import { JOB_TYPE_OPTIONS, LOCATION_OPTIONS } from '../data/options';
import { Card, Chip, ErrorPanel, LoadingPanel, PageHeader, PrimaryButton, SourceBadge, TagInput } from './ui';

function postedLabel(date: string | null) {
  if (!date) return null;
  const days = Math.floor((Date.now() - Date.parse(date)) / 86400000);
  if (!Number.isFinite(days)) return null;
  return days <= 0 ? 'Posted today' : days === 1 ? 'Posted yesterday' : `Posted ${days} days ago`;
}

export const JobMatcherTab: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { state, savePreferences, demo } = useCareer();
  const js = state.preferences.jobSearch;
  const [role, setRole] = useState(js.role || state.profile.targetRole);
  const [locations, setLocations] = useState<string[]>(js.locations);
  const [remote, setRemote] = useState(js.remote);
  const [jobTypes, setJobTypes] = useState<JobType[]>(js.jobTypes);
  const [result, setResult] = useState<JobSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const skills = [
    ...(state.resume?.parsedData.resume_data.skills?.technical || []),
    ...state.profile.currentSkills,
  ];

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (demo) setResult(demoJobs(skills));
      else setResult(await ApiService.searchJobs());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (js.updatedAt || demo) search();
  }, [js.updatedAt, demo, search]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await savePreferences({
        jobSearch: { role: role.trim() && role.trim() !== state.profile.targetRole ? role.trim() : null, locations, remote, jobTypes },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await search();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleType = (t: JobType) => setJobTypes(jobTypes.includes(t) ? jobTypes.filter((x) => x !== t) : [...jobTypes, t]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader icon={Briefcase} title="Jobs" subtitle="Real openings matched to your role, skills and preferences" />

      <Card className="space-y-5">
        <h3 className="text-base font-bold text-slate-900">What are you looking for?</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="job-role" className="block text-sm font-semibold text-slate-800">Job role</label>
            <input
              id="job-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              Defaults to your target role ({state.profile.targetRole}). Changing it here only affects job search.
            </p>
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-800">Where?</span>
            <TagInput values={locations} onChange={setLocations} placeholder="Add a city or region" suggestions={LOCATION_OPTIONS.filter((l) => !locations.includes(l)).slice(0, 8)} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 mt-1">
              <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="rounded border-slate-300" />
              Include remote jobs
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-slate-800">Type of job</span>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map((t) => (
              <Chip key={t.value} selected={jobTypes.includes(t.value)} onClick={() => toggleType(t.value)}>{t.label}</Chip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={save} disabled={saving || !role.trim()}>
            <Search className="w-4 h-4" /> {saving ? 'Saving…' : js.updatedAt ? 'Update and search' : 'Save and find jobs'}
          </PrimaryButton>
          {saved && <span className="text-sm text-emerald-700 font-semibold">Preferences saved</span>}
        </div>
      </Card>

      {error && <ErrorPanel message={error} onRetry={search} />}

      {loading && <Card><LoadingPanel messages={['Finding jobs that match your profile…']} /></Card>}

      {!loading && result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">
              {result.jobs.length ? `${result.jobs.length} matching jobs` : 'No matching jobs yet'}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {result.demo && <SourceBadge source="demo" />}
              {result.catalogUpdatedAt && <span>Job list updated {new Date(result.catalogUpdatedAt).toLocaleDateString()}</span>}
              {result.refreshing && <span className="inline-flex items-center gap-1 text-blue-600"><RefreshCw className="w-3 h-3 animate-spin" /> Fetching new {role} jobs…</span>}
            </div>
          </div>

          {result.jobs.length === 0 && (
            <Card className="text-sm text-slate-600">
              {result.refreshing
                ? `We're collecting fresh ${role} listings now. Check back in a few minutes.`
                : 'Try adding more locations, more job types, or turn on remote jobs.'}
            </Card>
          )}

          {result.jobs.map((job) => (
            <article key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:shadow-sm transition">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-slate-900">{job.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${job.matchScore >= 70 ? 'bg-emerald-100 text-emerald-800' : job.matchScore >= 45 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                    {job.matchScore}% match
                  </span>
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 text-sm text-slate-600 flex-wrap">
                  <span className="font-semibold text-slate-800">{job.company}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{job.location}</span>
                  {job.salary && <span>{job.salary}</span>}
                  {postedLabel(job.postedDate) && <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{postedLabel(job.postedDate)}</span>}
                </div>
                {job.matchReasons.length > 0 && (
                  <p className="text-xs text-slate-500">{job.matchReasons.join(' · ')}</p>
                )}
                {!result.demo && (
                  <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Listing completeness {job.credibility}/100 · via {job.source}
                  </p>
                )}
              </div>
              <a
                href={job.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 flex-shrink-0 self-start"
              >
                Apply <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </article>
          ))}
        </div>
      )}

      {!state.preferences.notifications.enabled && (
        <button onClick={() => onNavigate('notifications')} className="w-full text-left bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-3 hover:bg-blue-100/60 transition">
          <Bell className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <div className="text-sm font-bold text-blue-900">Get new matches on WhatsApp or Telegram</div>
            <div className="text-xs text-blue-800/80">Optional — choose a channel and how often.</div>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-600" />
        </button>
      )}
    </div>
  );
};

export default JobMatcherTab;
