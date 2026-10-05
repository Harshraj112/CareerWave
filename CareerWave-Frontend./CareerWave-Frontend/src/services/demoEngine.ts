/**
 * demoEngine.ts — local, offline results for DEMO MODE ONLY.
 *
 * Used when the user explicitly picks "Try with a sample resume", when
 * VITE_DEMO_MODE=true, or by legacy callers when the backend is unreachable.
 * Every object produced here has source: 'demo' and the UI shows a
 * "Sample data" badge on it. Real users get AI results from the backend.
 *
 * `legacyLocalAssessment` is the original ApiService.createAssessment
 * scoring (required skills + nice-to-have + seniority bonus), moved here
 * unchanged so it remains available as a fallback/testing mechanism.
 */
import type {
  Assessment, GapItem, ManualProfile, ResumeSchema, ResumeRecord, ScoreOverview,
  ImprovementAnalysis, CareerRoadmap, JobSearchResult, JobListing, CareerState, RoleProfile,
} from '../types';
import {
  SEEDED_ROLE_PROFILES, CURATED_LEARNING_RESOURCES, SEEDED_JOB_LISTINGS, DEMO_SAMPLE_RESUME,
} from '../data/mockData';

export function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function skillMatches(userSkill: string, targetSkill: string): boolean {
  const u = normalizeSkill(userSkill);
  const t = normalizeSkill(targetSkill);
  return u === t || u.includes(t) || t.includes(u);
}

export function emptyState(): CareerState {
  return {
    profile: {
      name: '', email: null, targetRole: '', path: null, experienceLevel: null, currentSkills: [],
      education: null, background: null, onboardingComplete: false, updatedAt: null,
    },
    resume: null,
    assessment: null,
    improvements: null,
    roadmap: null,
    roadmapProgress: {},
    preferences: {
      jobSearch: { role: null, locations: ['India'], remote: false, jobTypes: ['full-time'], updatedAt: null },
      notifications: {
        enabled: false, consent: false, consentAt: null, channel: null, telegramChatId: null,
        whatsappNumber: null, frequency: 'weekly', lastSentAt: null, updatedAt: null,
      },
    },
    updatedAt: null,
  };
}

function profileFor(role: string): RoleProfile {
  const found = SEEDED_ROLE_PROFILES.find((p) => p.role_title.toLowerCase() === role.toLowerCase())
    || SEEDED_ROLE_PROFILES.find((p) => role.toLowerCase().includes(p.role_title.split(' ')[0].toLowerCase()));
  if (found) return found;
  return {
    id: 'role_gen_' + Date.now(),
    role_title: role,
    category: 'Custom Field',
    source: 'llm_generated',
    required_skills: [
      { skill: role + ' Core Fundamentals', weight: 0.9, required: true, category: 'Core' },
      { skill: 'Problem Solving & Algorithms', weight: 0.85, required: true, category: 'Core' },
      { skill: 'Modern Frameworks & Tooling', weight: 0.8, required: true, category: 'Tools' },
      { skill: 'Git & Collaboration', weight: 0.7, required: false, category: 'Tools' },
      { skill: 'Testing & Documentation', weight: 0.6, required: false, category: 'Best Practices' },
    ],
  };
}

/** Original local scoring engine (moved from api.ts). Fallback/testing only. */
export function legacyLocalAssessment(payload: {
  user_id: string;
  resume_id?: string | null;
  target_role_title?: string;
  custom_jd_text?: string | null;
  manual_profile?: ManualProfile;
}, resume: ResumeSchema | null): Assessment {
  const targetTitle = payload.target_role_title || payload.manual_profile?.job_field || 'Frontend Developer';
  const profile = profileFor(targetTitle);

  let userSkills: string[] = [];
  let seniorityBonus = 8;
  if (payload.resume_id && resume?.skills) {
    userSkills = resume.skills;
    const expMonths = resume.experience.reduce((acc, cur) => acc + (cur.duration_months || 0), 0);
    seniorityBonus = expMonths >= 24 ? 10 : expMonths >= 12 ? 8 : 6;
  } else if (payload.manual_profile?.current_skills) {
    userSkills = payload.manual_profile.current_skills;
    if (payload.manual_profile.experience_level?.includes('Senior')) seniorityBonus = 10;
    else if (payload.manual_profile.experience_level?.includes('Mid')) seniorityBonus = 8;
    else seniorityBonus = 6;
  }

  const requiredSkills = profile.required_skills.filter((s) => s.required);
  const niceToHaveSkills = profile.required_skills.filter((s) => !s.required);
  let requiredMatched = 0;
  let niceMatched = 0;
  const gapList: GapItem[] = [];

  profile.required_skills.forEach((skillDef) => {
    const isPresent = userSkills.some((us) => skillMatches(us, skillDef.skill));
    if (skillDef.required) { if (isPresent) requiredMatched++; } else if (isPresent) niceMatched++;
    gapList.push({
      skill: skillDef.skill,
      priority: isPresent ? 'low' : skillDef.required ? 'high' : 'medium',
      present: isPresent,
      category: skillDef.category,
    });
  });

  const reqPct = requiredSkills.length > 0 ? requiredMatched / requiredSkills.length : 1;
  const nicePct = niceToHaveSkills.length > 0 ? niceMatched / niceToHaveSkills.length : 0.8;
  const overallScore = Math.min(100, Math.round((reqPct * 70) + (nicePct * 20) + seniorityBonus));

  return {
    id: 'asm_' + Math.random().toString(36).substring(2, 9),
    user_id: payload.user_id,
    resume_id: payload.resume_id,
    target_role_id: profile.id,
    target_role_title: profile.role_title,
    target_jd_text: payload.custom_jd_text,
    match_score: overallScore,
    score_breakdown: {
      keyword_match: Math.round(((requiredMatched + niceMatched) / Math.max(1, profile.required_skills.length)) * 100),
      seniority_match: seniorityBonus * 10,
      required_skills_hit: Math.round(reqPct * 100),
    },
    gap_list: gapList.sort((a, b) => {
      if (!a.present && b.present) return -1;
      if (a.present && !b.present) return 1;
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      return 0;
    }),
    created_at: new Date().toISOString(),
  };
}

// ── v2 demo generators ───────────────────────────────────────────────────────

export function demoResumeRecord(targetRole: string): ResumeRecord {
  const d = DEMO_SAMPLE_RESUME;
  return {
    id: 'res_demo',
    originalFilename: 'Alex_Rivera_Sample_Resume.pdf',
    uploadedAt: new Date().toISOString(),
    targetRole,
    parsedData: {
      input_mode: 'resume_analysis',
      warnings: [],
      resume_data: {
        parsing_meta: { is_resume: true, warnings: d.ats_issues },
        personal_info: {
          full_name: d.contact.name, email: d.contact.email, phone: d.contact.phone, location: null,
          linkedin_url: null, github_url: null, portfolio_url: null, other_links: [],
        },
        summary: null,
        total_experience_years: 3,
        work_experience: d.experience.map((e) => ({
          company: e.company, title: e.title, start_date: null, end_date: null, description: e.bullets, skills_used: [],
        })),
        education: d.education.map((e) => ({ institution: e.institution, degree: e.degree, end_date: e.year ?? null })),
        skills: { technical: d.skills, tools: [], soft: [], languages_spoken: [] },
        certifications: [], projects: [], publications: [], awards: [], volunteer_experience: [],
      },
    },
  };
}

export function demoAssessment(resume: ResumeRecord, targetRole: string): ScoreOverview {
  const skills = resume.parsedData.resume_data.skills?.technical || [];
  const legacy = legacyLocalAssessment(
    { user_id: 'demo', resume_id: resume.id, target_role_title: targetRole },
    { ...DEMO_SAMPLE_RESUME, skills },
  );
  const matched = legacy.gap_list.filter((g) => g.present);
  const missing = legacy.gap_list.filter((g) => !g.present);
  const s = legacy.match_score;
  const part = (max: number, pct: number) => Math.round(max * Math.min(1, pct / 100));
  const breakdown = [
    { key: 'role_keywords', label: 'Role keywords', max: 25, score: part(25, legacy.score_breakdown.keyword_match), reason: 'Sample estimate from keyword overlap.' },
    { key: 'skills_coverage', label: 'Skills coverage', max: 25, score: part(25, legacy.score_breakdown.required_skills_hit), reason: 'Sample estimate from required skills.' },
    { key: 'experience_relevance', label: 'Experience relevance', max: 20, score: part(20, legacy.score_breakdown.seniority_match), reason: 'Sample estimate from years of experience.' },
    { key: 'impact_evidence', label: 'Impact & evidence', max: 15, score: 9, reason: 'Some bullets include metrics.' },
    { key: 'ats_readability', label: 'ATS readability', max: 15, score: 10, reason: 'Two-column layout flagged.' },
  ];
  const atsScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  return {
    id: 'asm_demo',
    createdAt: new Date().toISOString(),
    source: 'demo',
    targetRole,
    resumeId: resume.id,
    atsScore,
    scoreLabel: atsScore >= 85 ? 'Strong' : atsScore >= 70 ? 'Competitive' : atsScore >= 50 ? 'Developing' : 'Needs work',
    interpretation: `Sample analysis: this resume covers ${matched.length} of ${legacy.gap_list.length} skills commonly asked for ${targetRole} roles (local estimate ${s}/100).`,
    scoreBreakdown: breakdown,
    skillsMatched: matched.map((g) => ({ skill: g.skill, evidence: 'Listed in the skills section' })),
    skillsMissing: missing.map((g) => ({ skill: g.skill, importance: g.priority, reason: g.priority === 'high' ? 'Required in most postings' : 'Nice to have' })),
    experienceAlignment: { rating: 'partial', summary: 'Three years of web development, mostly frontend.', relevantYears: 3 },
    resumeIssues: (resume.parsedData.resume_data.parsing_meta?.warnings || []).map((issue) => ({ issue, severity: 'medium' as const })),
    strengths: matched.slice(0, 3).map((g) => `Hands-on ${g.skill}`),
    weaknesses: missing.slice(0, 3).map((g) => `No evidence of ${g.skill}`),
    experienceLevel: 'Entry-level (0-2 years)',
  };
}

export function demoImprovements(a: ScoreOverview): ImprovementAnalysis {
  const top = a.skillsMissing[0]?.skill || 'a core skill';
  return {
    id: 'imp_demo',
    createdAt: new Date().toISOString(),
    source: 'demo',
    targetRole: a.targetRole,
    summary: `Sample analysis: the biggest gap for ${a.targetRole} is ${top}. Upload your own resume for a real AI analysis.`,
    priorities: [`Show evidence of ${top}`, 'Quantify project outcomes', 'Use a single-column layout'],
    items: [
      ...a.skillsMissing.slice(0, 3).map((m, i) => ({
        id: `imp_demo_s${i}`, category: 'skills' as const, problem: `No evidence of ${m.skill}`,
        explanation: `The resume never mentions ${m.skill}.`, impact: m.reason, fix: `Add a project or bullet that uses ${m.skill}.`,
        suggestedAction: `Build a small ${m.skill} project.`, priority: m.importance, missingEvidence: `A project using ${m.skill}`, example: null,
      })),
      {
        id: 'imp_demo_ats', category: 'ats' as const, problem: 'Two-column layout',
        explanation: 'Some ATS read columns out of order.', impact: 'Experience may be parsed incorrectly.',
        fix: 'Switch to a single-column template.', suggestedAction: 'Re-export the resume in one column.',
        priority: 'medium' as const, missingEvidence: null, example: null,
      },
    ],
  };
}

export function demoRoadmap(targetRole: string, knownSkills: string[], mode: 'resume' | 'beginner'): CareerRoadmap {
  const profile = profileFor(targetRole);
  const gaps = profile.required_skills.filter((s) => !knownSkills.some((k) => skillMatches(k, s.skill)));
  const stages = gaps.slice(0, 6).map((g, i) => {
    const key = Object.keys(CURATED_LEARNING_RESOURCES).find((k) => skillMatches(g.skill, k));
    const res = key ? CURATED_LEARNING_RESOURCES[key] : [];
    return {
      id: `stage-${i + 1}`, order: i + 1, title: g.skill, skills: [g.skill],
      reason: `${g.required ? 'Required' : 'Common'} for ${targetRole} roles.`,
      priority: (g.required ? 'high' : 'medium') as 'high' | 'medium',
      prerequisites: i ? [gaps[i - 1].skill] : [], topics: [], expectedOutcome: `Use ${g.skill} in a project.`,
      estimatedTime: '2–4 weeks', estimatedHours: res[0]?.est_hours || 20,
      projects: [], resources: res.map((r) => ({ title: r.title, type: (r.type === 'doc' ? 'docs' : r.type) as 'docs' | 'course' | 'book', provider: null, url: r.url })),
      milestone: `One project using ${g.skill}.`,
    };
  });
  return {
    id: 'rdm_demo', createdAt: new Date().toISOString(), source: 'demo', mode, targetRole,
    startingPoint: 'Sample roadmap based on a fixed skill list, not on your profile.',
    summary: `Sample path covering ${stages.length} skill gaps for ${targetRole}.`,
    totalEstimatedTime: 'approximate', stages,
    interviewPrep: { topics: [], tips: [] }, readinessMilestones: [], generalTips: [],
  };
}

export function demoJobs(skills: string[]): JobSearchResult {
  const jobs: JobListing[] = SEEDED_JOB_LISTINGS.map((job) => {
    const matched = job.required_skills.filter((req) => skills.some((s) => skillMatches(s, req)));
    return {
      id: job.id, title: job.title, company: job.company, location: job.location, salary: job.salary_range,
      postedDate: null, source: 'sample', link: job.apply_url, tags: job.required_skills, description: job.raw_description,
      isRemote: /remote/i.test(job.location), credibility: 0,
      matchScore: Math.round((matched.length / Math.max(1, job.required_skills.length)) * 100),
      matchReasons: matched.length ? [`Mentions ${matched.slice(0, 3).join(', ')}`] : [],
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
  return { jobs, catalogSize: jobs.length, catalogUpdatedAt: null, refreshing: false, scraperAvailable: false, demo: true };
}

/** Legacy ResumeSchema view of a v2 resume record. */
export function toLegacyResume(record: ResumeRecord): ResumeSchema {
  const rd = record.parsedData.resume_data || {};
  const s = rd.skills || {};
  return {
    contact: {
      name: rd.personal_info?.full_name || '',
      email: rd.personal_info?.email || '',
      phone: rd.personal_info?.phone || '',
    },
    skills: [...(s.technical || []), ...(s.tools || []), ...(s.soft || [])],
    experience: (rd.work_experience || []).map((e) => ({
      title: e.title || '', company: e.company || '', bullets: e.description || [], duration_months: 0,
    })),
    education: (rd.education || []).map((e) => ({
      degree: e.degree || '', institution: e.institution || '', year: e.end_date || undefined,
    })),
    ats_issues: [...(rd.parsing_meta?.warnings || []), ...(record.parsedData.warnings || [])],
  };
}
