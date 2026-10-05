/**
 * careerAgent.js — personalised career reasoning.
 *
 * The resume parser EXTRACTS (what is on the resume). This agent ANALYSES
 * (score, gaps, improvements, roadmap). Each call receives one structured
 * context object:
 *
 *   { user: { name, target_role, experience_level, current_skills, education, background },
 *     resume: <parsed resume_data>,
 *     assessment: { score, matched_skills, missing_skills, weaknesses, ... },
 *     preferences: { locations, job_types } }
 *
 * and returns validated JSON (see normalize.js) that the frontend renders as-is.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chatJson, describeProvider } from "../../resume-parser/src/ai-provider.js";
import { normalizeAssessment, normalizeImprovements, normalizeRoadmap } from "./normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptCache = new Map();

function prompt(name) {
  if (!promptCache.has(name)) {
    promptCache.set(name, fs.readFileSync(path.join(__dirname, "prompts", `${name}.md`), "utf8"));
  }
  return promptCache.get(name);
}

/** Remove null / empty values so the context stays small and readable. */
export function compact(value) {
  if (Array.isArray(value)) {
    const out = value.map(compact).filter((v) => v !== undefined);
    return out.length ? out : undefined;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const c = compact(v);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === undefined || value === "") return undefined;
  return value;
}

function meta(task, user) {
  const { provider, model } = describeProvider();
  return {
    source: provider === "mock" ? "mock" : "ai",
    model,
    task,
    targetRole: user.profile.targetRole,
  };
}

function resumeData(user) {
  return user.resume?.parsedData?.resume_data || null;
}

function assessmentSummary(a) {
  if (!a) return undefined;
  return {
    score: a.atsScore,
    label: a.scoreLabel,
    breakdown: a.scoreBreakdown?.map((b) => ({ category: b.label, score: `${b.score}/${b.max}`, reason: b.reason })),
    matched_skills: a.skillsMatched?.map((s) => s.skill),
    missing_skills: a.skillsMissing?.map((s) => ({ skill: s.skill, importance: s.importance })),
    experience_alignment: a.experienceAlignment,
    resume_issues: a.resumeIssues,
    strengths: a.strengths,
    weaknesses: a.weaknesses,
  };
}

export function buildContext(user, extra = {}) {
  const p = user.profile;
  const rd = resumeData(user);
  return compact({
    user: {
      name: p.name,
      target_role: p.targetRole,
      experience_level: p.experienceLevel || user.assessment?.experienceLevel,
      current_skills: p.currentSkills,
      education: p.education,
      background: p.background,
    },
    resume: rd
      ? {
          ...rd,
          // The parser's own heuristic analysis is useful input, not the final answer.
          parser_ats_analysis: rd.ats_analysis,
          ats_analysis: undefined,
          parsing_warnings: rd.parsing_meta?.warnings,
          parsing_meta: undefined,
        }
      : undefined,
    assessment: assessmentSummary(user.assessment),
    preferences: {
      locations: user.preferences?.jobSearch?.locations,
      job_types: user.preferences?.jobSearch?.jobTypes,
    },
    ...extra,
  });
}

async function run(task, user, extra) {
  const context = buildContext(user, extra);
  const messages = [
    { role: "system", content: prompt("system") },
    {
      role: "user",
      content: `${prompt(task)}\n\nCONTEXT (JSON):\n<context>\n${JSON.stringify(context, null, 1)}\n</context>`,
    },
  ];
  return chatJson(messages, { task: `career-${task}`, temperature: 0.2 });
}

export async function assessResume(user) {
  if (!resumeData(user)) throw Object.assign(new Error("Upload a resume before running the assessment."), { status: 409 });
  const raw = await run("assessment", user);
  return normalizeAssessment(raw, { ...meta("assessment", user), resumeId: user.resume.id });
}

export async function analyseImprovements(user) {
  if (!resumeData(user)) throw Object.assign(new Error("Upload a resume first."), { status: 409 });
  const raw = await run("improvements", user);
  return normalizeImprovements(raw, { ...meta("improvements", user), resumeId: user.resume.id, assessmentId: user.assessment?.id || null });
}

export async function generateRoadmap(user, mode) {
  const extra = { mode };
  if (mode === "resume" && user.improvements) {
    extra.improvement_priorities = user.improvements.priorities;
  }
  const raw = await run("roadmap", user, extra);
  return normalizeRoadmap(raw, {
    ...meta("roadmap", user),
    mode,
    resumeId: mode === "resume" ? user.resume?.id || null : null,
    experienceLevel: user.profile.experienceLevel || user.assessment?.experienceLevel || null,
  });
}
