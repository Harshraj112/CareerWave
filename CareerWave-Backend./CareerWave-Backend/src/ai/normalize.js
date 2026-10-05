/**
 * normalize.js — coerce AI output into the exact shapes the frontend renders.
 *
 * Models occasionally drop a field, return a string where an array was asked
 * for, or produce a total that doesn't add up. Everything the UI reads goes
 * through here so a slightly-off response degrades gracefully instead of
 * crashing a screen.
 */
import crypto from "crypto";

const str = (v, fallback = "") => (v === null || v === undefined ? fallback : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v : v === null || v === undefined || v === "" ? [] : [v]);
const strList = (v, max = 20) => arr(v).map((x) => (typeof x === "string" ? x : x?.text || x?.title || x?.name || "")).map((x) => str(x)).filter(Boolean).slice(0, max);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const level = (v, allowed, fallback) => {
  const s = str(v).toLowerCase();
  return allowed.includes(s) ? s : fallback;
};
const PRIORITY = ["high", "medium", "low"];
export const newId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString("hex")}`;

export const BREAKDOWN = [
  { key: "role_keywords", label: "Role keywords", max: 25 },
  { key: "skills_coverage", label: "Skills coverage", max: 25 },
  { key: "experience_relevance", label: "Experience relevance", max: 20 },
  { key: "impact_evidence", label: "Impact & evidence", max: 15 },
  { key: "ats_readability", label: "ATS readability", max: 15 },
];

export const EXPERIENCE_LEVELS = [
  "Beginner / Student",
  "Entry-level (0-2 years)",
  "Mid-level (3-5 years)",
  "Senior (5+ years)",
];

export function scoreLabelFor(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Competitive";
  if (score >= 50) return "Developing";
  return "Needs work";
}

export function normalizeAssessment(raw, meta) {
  const r = raw || {};
  const given = arr(r.scoreBreakdown || r.score_breakdown);
  const scoreBreakdown = BREAKDOWN.map((def) => {
    const hit = given.find((g) => str(g?.key).toLowerCase() === def.key) || given.find((g) => str(g?.label).toLowerCase() === def.label.toLowerCase());
    return {
      key: def.key,
      label: def.label,
      max: def.max,
      score: clamp(Math.round(num(hit?.score, 0)), 0, def.max),
      reason: str(hit?.reason),
    };
  });
  const atsScore = clamp(scoreBreakdown.reduce((sum, b) => sum + b.score, 0), 0, 100);

  const experienceLevel = EXPERIENCE_LEVELS.find((l) => l.toLowerCase() === str(r.experienceLevel).toLowerCase())
    || EXPERIENCE_LEVELS.find((l) => str(r.experienceLevel).toLowerCase().startsWith(l.split(/[ -]/)[0].toLowerCase()))
    || null;

  return {
    id: newId("asm"),
    createdAt: new Date().toISOString(),
    ...meta,
    atsScore,
    scoreLabel: scoreLabelFor(atsScore),
    interpretation: str(r.interpretation),
    scoreBreakdown,
    skillsMatched: arr(r.skillsMatched).map((s) => ({ skill: str(s?.skill ?? s), evidence: str(s?.evidence) })).filter((s) => s.skill).slice(0, 12),
    skillsMissing: arr(r.skillsMissing).map((s) => ({
      skill: str(s?.skill ?? s),
      importance: level(s?.importance, PRIORITY, "medium"),
      reason: str(s?.reason),
    })).filter((s) => s.skill).slice(0, 12),
    experienceAlignment: {
      rating: level(r.experienceAlignment?.rating, ["strong", "partial", "weak"], "partial"),
      summary: str(r.experienceAlignment?.summary),
      relevantYears: r.experienceAlignment?.relevantYears === null || r.experienceAlignment?.relevantYears === undefined
        ? null
        : num(r.experienceAlignment.relevantYears, null),
    },
    resumeIssues: arr(r.resumeIssues).map((i) => ({ issue: str(i?.issue ?? i), severity: level(i?.severity, PRIORITY, "medium") })).filter((i) => i.issue).slice(0, 12),
    strengths: strList(r.strengths, 6),
    weaknesses: strList(r.weaknesses, 6),
    experienceLevel,
  };
}

export const IMPROVEMENT_CATEGORIES = {
  structure: "Resume structure",
  ats: "ATS & readability",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  keywords: "Keywords",
  role_alignment: "Target-role alignment",
  evidence: "Missing evidence",
};

export function normalizeImprovements(raw, meta) {
  const r = raw || {};
  const order = { high: 0, medium: 1, low: 2 };
  const items = arr(r.items)
    .map((it) => {
      const cat = str(it?.category).toLowerCase().replace(/[\s-]+/g, "_");
      const example = it?.example && (it.example.before || it.example.after)
        ? { before: str(it.example.before), after: str(it.example.after) }
        : null;
      return {
        id: newId("imp"),
        category: IMPROVEMENT_CATEGORIES[cat] ? cat : "role_alignment",
        problem: str(it?.problem),
        explanation: str(it?.explanation),
        impact: str(it?.impact),
        fix: str(it?.fix),
        suggestedAction: str(it?.suggestedAction || it?.suggested_action),
        priority: level(it?.priority, PRIORITY, "medium"),
        missingEvidence: str(it?.missingEvidence || it?.missing_evidence) || null,
        example,
      };
    })
    .filter((it) => it.problem)
    .sort((a, b) => order[a.priority] - order[b.priority]);

  return {
    id: newId("imp"),
    createdAt: new Date().toISOString(),
    ...meta,
    summary: str(r.summary),
    priorities: strList(r.priorities, 5),
    items,
  };
}

const RESOURCE_TYPES = ["course", "book", "docs", "video", "practice"];

function safeUrl(u) {
  const s = str(u);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : null;
}

export function normalizeRoadmap(raw, meta) {
  const r = raw || {};
  const stages = arr(r.stages).map((s, i) => ({
    id: `stage-${i + 1}`,
    order: i + 1,
    title: str(s?.title || s?.stage_name, `Stage ${i + 1}`),
    skills: strList(s?.skills, 12),
    reason: str(s?.reason || s?.goal),
    priority: level(s?.priority, PRIORITY, "medium"),
    prerequisites: strList(s?.prerequisites, 8),
    topics: strList(s?.topics || s?.topics_to_learn, 15),
    expectedOutcome: str(s?.expectedOutcome),
    estimatedTime: str(s?.estimatedTime || s?.estimated_time),
    estimatedHours: clamp(Math.round(num(s?.estimatedHours, 0)), 0, 2000),
    projects: arr(s?.projects).map((p) => ({ title: str(p?.title ?? p), description: str(p?.description) })).filter((p) => p.title).slice(0, 3),
    resources: arr(s?.resources).map((res) => ({
      title: str(res?.title ?? res),
      type: level(res?.type, RESOURCE_TYPES, "course"),
      provider: str(res?.provider) || null,
      url: safeUrl(res?.url),
    })).filter((res) => res.title).slice(0, 6),
    milestone: str(s?.milestone),
  })).filter((s) => s.title);

  return {
    id: newId("rdm"),
    createdAt: new Date().toISOString(),
    ...meta,
    startingPoint: str(r.startingPoint),
    summary: str(r.summary),
    totalEstimatedTime: str(r.totalEstimatedTime),
    stages,
    interviewPrep: { topics: strList(r.interviewPrep?.topics, 15), tips: strList(r.interviewPrep?.tips, 10) },
    readinessMilestones: arr(r.readinessMilestones).map((m) => ({ title: str(m?.title ?? m), criteria: str(m?.criteria) })).filter((m) => m.title).slice(0, 8),
    generalTips: strList(r.generalTips, 6),
  };
}

/**
 * The old Spring Boot /roadmap contract (stage_name / goal / topics_to_learn /
 * courses / books / practical_tips). Returned alongside the new roadmap so the
 * existing frontend mapping (mapRoadmapToResources) keeps working.
 */
export function toLegacyRoadmap(roadmap) {
  return {
    starting_point: roadmap.startingPoint,
    stages: roadmap.stages.map((s) => ({
      stage_name: s.title,
      goal: s.reason,
      estimated_time: s.estimatedTime,
      topics_to_learn: s.topics.length ? s.topics : s.skills,
      courses: s.resources.filter((r) => r.type !== "book").map((r) => ({ title: r.title, provider: r.provider, url: r.url })),
      books: s.resources.filter((r) => r.type === "book").map((r) => ({ title: r.title, author: r.provider, url: r.url })),
      practical_tips: s.projects.map((p) => `${p.title}: ${p.description}`),
    })),
    general_tips: roadmap.generalTips,
  };
}
