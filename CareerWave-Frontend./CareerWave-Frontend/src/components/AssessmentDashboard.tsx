/**
 * The main score breakdown: "How good is my resume for the job I want?"
 * Renders a ScoreOverview from the AI assessment — no local scoring here.
 */
import React from 'react';
import { CheckCircle2, XCircle, Briefcase, AlertTriangle } from 'lucide-react';
import type { ScoreOverview } from '../types';
import { Card, PriorityBadge } from './ui';

const ALIGN = {
  strong: { text: 'Strong alignment', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  partial: { text: 'Partial alignment', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  weak: { text: 'Weak alignment', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export const AssessmentDashboard: React.FC<{ assessment: ScoreOverview }> = ({ assessment: a }) => {
  const align = ALIGN[a.experienceAlignment.rating];
  return (
    <div className="space-y-5">
      <Card>
        <h3 className="text-sm font-bold text-slate-900 mb-4">How your score is made up</h3>
        <div className="space-y-3.5">
          {a.scoreBreakdown.map((b) => {
            const pct = Math.round((b.score / b.max) * 100);
            const bar = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-600' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <div key={b.key}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-700">{b.label}</span>
                  <span className="text-slate-500 tabular-nums">{b.score} / {b.max}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
                  <div className={`${bar} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                {b.reason && <p className="text-xs text-slate-500 mt-1">{b.reason}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Skills you match ({a.skillsMatched.length})
          </h3>
          {a.skillsMatched.length === 0 ? (
            <p className="text-sm text-slate-500">No role skills were clearly evidenced yet.</p>
          ) : (
            <ul className="space-y-2">
              {a.skillsMatched.map((s) => (
                <li key={s.skill} className="text-sm">
                  <span className="font-semibold text-slate-800">{s.skill}</span>
                  {s.evidence && <span className="text-slate-500"> — {s.evidence}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" /> Missing or weak skills ({a.skillsMissing.length})
          </h3>
          {a.skillsMissing.length === 0 ? (
            <p className="text-sm text-slate-500">No major skill gaps for this role.</p>
          ) : (
            <ul className="space-y-2.5">
              {a.skillsMissing.map((s) => (
                <li key={s.skill} className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{s.skill}</span>
                    <PriorityBadge priority={s.importance}>{s.importance === 'high' ? 'Often required' : s.importance === 'medium' ? 'Common' : 'Nice to have'}</PriorityBadge>
                  </div>
                  {s.reason && <p className="text-xs text-slate-500 mt-0.5">{s.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-blue-600" /> Experience alignment
          </h3>
          <span className={`inline-block px-2.5 py-1 rounded-full border text-xs font-semibold ${align.cls}`}>{align.text}</span>
          {a.experienceAlignment.relevantYears !== null && (
            <span className="ml-2 text-xs text-slate-500">≈ {a.experienceAlignment.relevantYears} relevant year(s)</span>
          )}
          <p className="text-sm text-slate-600 mt-3">{a.experienceAlignment.summary}</p>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Resume & ATS issues ({a.resumeIssues.length})
          </h3>
          {a.resumeIssues.length === 0 ? (
            <p className="text-sm text-slate-500">No formatting or ATS problems found.</p>
          ) : (
            <ul className="space-y-2">
              {a.resumeIssues.map((i) => (
                <li key={i.issue} className="flex items-start gap-2 text-sm text-slate-700">
                  <PriorityBadge priority={i.severity}>{i.severity}</PriorityBadge>
                  <span>{i.issue}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AssessmentDashboard;
