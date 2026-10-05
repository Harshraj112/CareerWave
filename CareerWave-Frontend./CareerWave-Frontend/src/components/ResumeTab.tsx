/**
 * Resume — everything the parser extracted, plus replace / upload.
 * Detailed fields live here so the dashboard can stay focused on the score.
 */
import React, { useState } from 'react';
import { FileText, Mail, Phone, MapPin, Link2, AlertCircle, RefreshCw, Target, ArrowRight } from 'lucide-react';
import type { ParsedResumeData } from '../types';
import { useCareer } from '../state/CareerContext';
import { PathAResumeUpload } from './PathAResumeUpload';
import { Card, PageHeader, SourceBadge } from './ui';

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="text-sm font-bold text-slate-900 mb-3">{title}{count !== undefined && <span className="text-slate-400 font-medium"> ({count})</span>}</h3>
      {children}
    </Card>
  );
}

const dateRange = (a?: string | null, b?: string | null) => [a, b].filter(Boolean).join(' – ');

export default function ResumeTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { state, demo, exitDemo } = useCareer();
  const [replacing, setReplacing] = useState(false);
  const resume = state.resume;

  if (!resume || replacing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          icon={FileText}
          title={resume ? 'Replace your resume' : 'Upload your resume'}
          subtitle={<>It will be scored for <span className="font-semibold text-slate-700">{state.profile.targetRole}</span></>}
        />
        <PathAResumeUpload embedded onComplete={() => { setReplacing(false); onNavigate('dashboard'); }} />
        {resume && <button onClick={() => setReplacing(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Cancel</button>}
      </div>
    );
  }

  const rd: ParsedResumeData = resume.parsedData.resume_data || {};
  const pi = rd.personal_info;
  const links = [pi?.linkedin_url, pi?.github_url, pi?.portfolio_url, ...(pi?.other_links || [])].filter(Boolean) as string[];
  const warnings = [...(rd.parsing_meta?.warnings || []), ...(resume.parsedData.warnings || [])];
  const skillGroups = [
    ['Technical', rd.skills?.technical], ['Tools', rd.skills?.tools], ['Soft skills', rd.skills?.soft], ['Languages', rd.skills?.languages_spoken],
  ].filter(([, v]) => (v as string[] | undefined)?.length) as [string, string[]][];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon={FileText}
        title="Your resume"
        subtitle={<>{resume.originalFilename} · uploaded {new Date(resume.uploadedAt).toLocaleDateString()}</>}
        right={
          <div className="flex items-center gap-2">
            {demo && <SourceBadge source="demo" />}
            <button
              onClick={() => (demo ? exitDemo().then(() => setReplacing(true)) : setReplacing(true))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {demo ? 'Upload my real resume' : 'Replace resume'}
            </button>
          </div>
        }
      />

      {state.assessment && (
        <button onClick={() => onNavigate('dashboard')} className="w-full text-left rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-center gap-3 hover:bg-blue-100/60">
          <Target className="w-5 h-5 text-blue-600" />
          <span className="flex-1 text-sm text-blue-900">
            ATS score <strong>{state.assessment.atsScore}/100</strong> for {state.assessment.targetRole}
          </span>
          <ArrowRight className="w-4 h-4 text-blue-600" />
        </button>
      )}

      <Card className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900">{pi?.full_name || state.profile.name || 'Name not found'}</h3>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
          {pi?.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" />{pi.email}</span>}
          {pi?.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" />{pi.phone}</span>}
          {pi?.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{pi.location}</span>}
          {rd.total_experience_years ? <span>{rd.total_experience_years} years experience</span> : null}
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Link2 className="w-3.5 h-3.5" />{l.replace(/^https?:\/\//, '')}
              </a>
            ))}
          </div>
        )}
        {rd.summary && <p className="text-sm text-slate-700 leading-relaxed">{rd.summary}</p>}
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" /> Things the parser flagged</h3>
          <ul className="space-y-1 text-sm text-amber-950 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {skillGroups.length > 0 && (
        <Section title="Skills">
          <div className="space-y-3">
            {skillGroups.map(([label, list]) => (
              <div key={label}>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">{label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => <span key={s} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium">{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!!rd.work_experience?.length && (
        <Section title="Experience" count={rd.work_experience.length}>
          <div className="space-y-4">
            {rd.work_experience.map((w, i) => (
              <div key={i}>
                <div className="flex justify-between gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{w.title}{w.company && <span className="font-medium text-slate-600"> · {w.company}</span>}</span>
                  <span className="text-xs text-slate-500">{dateRange(w.start_date, w.is_current ? 'Present' : w.end_date)}</span>
                </div>
                {!!w.description?.length && <ul className="mt-1.5 space-y-1 text-sm text-slate-600 list-disc pl-5">{w.description.map((d, j) => <li key={j}>{d}</li>)}</ul>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {!!rd.projects?.length && (
        <Section title="Projects" count={rd.projects.length}>
          <div className="space-y-3">
            {rd.projects.map((p, i) => (
              <div key={i}>
                <div className="text-sm font-bold text-slate-900">{p.name}{p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-blue-600 font-normal hover:underline">link</a>}</div>
                {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
                {!!p.tech_stack?.length && <p className="text-xs text-slate-500 mt-0.5">{p.tech_stack.join(', ')}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {!!rd.education?.length && (
        <Section title="Education" count={rd.education.length}>
          <div className="space-y-2">
            {rd.education.map((e, i) => (
              <div key={i} className="text-sm">
                <span className="font-bold text-slate-900">{[e.degree, e.field_of_study].filter(Boolean).join(', ') || e.institution}</span>
                {e.degree && e.institution && <span className="text-slate-600"> · {e.institution}</span>}
                <span className="text-xs text-slate-500 ml-2">{dateRange(e.start_date, e.end_date)}{e.gpa ? ` · GPA ${e.gpa}` : ''}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!!rd.certifications?.length && (
        <Section title="Certifications" count={rd.certifications.length}>
          <ul className="space-y-1 text-sm text-slate-700">{rd.certifications.map((c, i) => <li key={i}><span className="font-semibold">{c.name}</span>{c.issuer && ` · ${c.issuer}`}{c.date_obtained && <span className="text-slate-500"> ({c.date_obtained})</span>}</li>)}</ul>
        </Section>
      )}

      {!!rd.awards?.length && (
        <Section title="Awards & achievements" count={rd.awards.length}>
          <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">{rd.awards.map((a, i) => <li key={i}>{a.title}{a.issuer && ` · ${a.issuer}`}</li>)}</ul>
        </Section>
      )}

      {!!rd.publications?.length && (
        <Section title="Publications" count={rd.publications.length}>
          <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">{rd.publications.map((p, i) => <li key={i}>{p.title}{p.publisher && ` · ${p.publisher}`}</li>)}</ul>
        </Section>
      )}

      {!!rd.volunteer_experience?.length && (
        <Section title="Leadership & volunteering" count={rd.volunteer_experience.length}>
          <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">{rd.volunteer_experience.map((v, i) => <li key={i}>{[v.role, v.organization].filter(Boolean).join(' · ')}</li>)}</ul>
        </Section>
      )}
    </div>
  );
}
