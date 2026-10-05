/**
 * mockAgent.js — deterministic stand-in for the LLM when AI_PROVIDER=mock.
 *
 * Purpose: automated tests and local development without an API key.
 * Everything produced here is tagged source:"mock" by the career agent, and
 * the frontend shows a visible "Test data" badge on it. It is never used when
 * a real provider is configured.
 */
import { setMockHandler } from "../../resume-parser/src/ai-provider.js";
import { resolveRole, ROLE_LIBRARY, normalizeText } from "../data/roles.js";

const ALL_SKILLS = [...new Set(ROLE_LIBRARY.flatMap((r) => r.skills).concat([
  "Kotlin", "C++", "C", "Go", "Rust", "MongoDB", "PostgreSQL", "MySQL", "Redis", "GraphQL", "Express", "Django", "Flask",
  "FastAPI", "Spring Boot", "Angular", "Vue", "Redux", "Jest", "Figma", "Scikit-learn", "TensorFlow", "Keras", "OpenCV",
]))];

function textOf(messages) {
  return messages.map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => p.text || "").join("\n"))).join("\n");
}

function skillsIn(text) {
  const t = ` ${normalizeText(text)} `;
  return ALL_SKILLS.filter((s) => t.includes(` ${normalizeText(s)} `) || t.includes(` ${normalizeText(s)},`));
}

function mockParse(all) {
  const resumeText = (all.split("RESUME TEXT:")[1] || "").split("ROLE APPLIED FOR:")[0];
  const role = (all.match(/ROLE APPLIED FOR:\s*(.+)/) || [])[1]?.trim() || null;
  const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const email = (resumeText.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || null;
  const phone = (resumeText.match(/\+?\d[\d\s-]{8,}\d/) || [])[0] || null;
  const skills = skillsIn(resumeText);
  const experienceLines = lines.filter((l) => /(intern|developer|engineer|analyst|at |@)/i.test(l)).slice(0, 3);
  return {
    input_mode: "resume_analysis",
    target: { stated_explicitly: Boolean(role), target_description: role, inference_basis: role ? "user provided target role" : null },
    resume_data: {
      parsing_meta: { is_resume: true, warnings: [] },
      personal_info: { full_name: lines[0] || null, email, phone, location: null, linkedin_url: null, github_url: null, portfolio_url: null, other_links: [] },
      summary: lines.find((l) => l.length > 60) || null,
      total_experience_years: null,
      work_experience: experienceLines.map((l) => ({ company: null, title: l.slice(0, 80), location: null, start_date: null, end_date: null, is_current: false, employment_type: null, description: [l], skills_used: skillsIn(l) })),
      education: lines.filter((l) => /(b\.?tech|bachelor|b\.?e\.?|degree|university|college|b\.?sc)/i.test(l)).slice(0, 2).map((l) => ({ institution: l, degree: null, field_of_study: null, location: null, start_date: null, end_date: null, gpa: null, honors: [] })),
      skills: { technical: skills, tools: [], soft: [], languages_spoken: [] },
      certifications: [], projects: lines.filter((l) => /project/i.test(l)).slice(0, 3).map((l) => ({ name: l.slice(0, 60), description: l, tech_stack: skillsIn(l), url: null, date: null })),
      publications: [], awards: [], volunteer_experience: [],
      ats_analysis: { overall_score: 60, subscores: [], note: "mock" },
      gap_analysis: [], suggestions: [], learning_recommendations: [],
    },
    roadmap: null,
    warnings: [],
    clarification_needed: [],
  };
}

function contextOf(all) {
  const m = all.match(/<context>\s*([\s\S]*?)\s*<\/context>/);
  try {
    return m ? JSON.parse(m[1]) : {};
  } catch {
    return {};
  }
}

function roleSkills(ctx) {
  const role = resolveRole(ctx.user?.target_role) || ROLE_LIBRARY.find((r) => r.key === "swe");
  return role.skills;
}

function haveSkills(ctx) {
  const rs = ctx.resume?.skills || {};
  return [...(rs.technical || []), ...(rs.tools || []), ...(ctx.user?.current_skills || [])];
}

function mockAssessment(ctx) {
  const needed = roleSkills(ctx);
  const have = haveSkills(ctx).map(normalizeText);
  const matched = needed.filter((s) => have.some((h) => h.includes(normalizeText(s)) || normalizeText(s).includes(h)));
  const missing = needed.filter((s) => !matched.includes(s));
  const ratio = matched.length / needed.length;
  const role = ctx.user?.target_role || "your target role";
  return {
    scoreBreakdown: [
      { key: "role_keywords", score: Math.round(25 * Math.max(0.3, ratio)), reason: `Uses ${matched.length} of ${needed.length} core ${role} keywords.` },
      { key: "skills_coverage", score: Math.round(25 * ratio), reason: `Evidence for ${matched.slice(0, 3).join(", ") || "few core skills"}.` },
      { key: "experience_relevance", score: ctx.resume?.work_experience ? 12 : 6, reason: "Experience partly aligned with the role." },
      { key: "impact_evidence", score: 7, reason: "Few bullets show measurable results." },
      { key: "ats_readability", score: 12, reason: "Standard sections detected." },
    ],
    interpretation: `Your resume shows a foundation for ${role} roles, but ${missing[0] || "measurable impact"} is the biggest gap holding the score back.`,
    skillsMatched: matched.map((s) => ({ skill: s, evidence: "Listed in your skills section" })),
    skillsMissing: missing.map((s, i) => ({ skill: s, importance: i < 3 ? "high" : "medium", reason: `Commonly listed in ${role} postings.` })),
    experienceAlignment: { rating: ratio > 0.6 ? "strong" : "partial", summary: "Some experience maps to the role's day-to-day work.", relevantYears: null },
    resumeIssues: [{ issue: "Bullets describe duties rather than outcomes", severity: "medium" }],
    strengths: matched.slice(0, 3).map((s) => `Hands-on ${s}`),
    weaknesses: missing.slice(0, 3).map((s) => `No evidence of ${s}`),
    experienceLevel: "Entry-level (0-2 years)",
  };
}

function mockImprovements(ctx) {
  const missing = (ctx.assessment?.missing_skills || []).map((s) => s.skill);
  const role = ctx.user?.target_role || "the role";
  return {
    summary: `The resume lists relevant tools but rarely proves results. Adding evidence for ${missing[0] || "key skills"} is the biggest lever for ${role}.`,
    priorities: [`Add a project that uses ${missing[0] || "a core skill"}`, "Rewrite bullets with measurable outcomes", `Mirror ${role} keywords in your summary`],
    items: [
      { category: "skills", problem: `No evidence of ${missing[0] || "a core skill"}`, explanation: `Your resume never mentions ${missing[0] || "this skill"}.`, impact: `Most ${role} postings filter on it.`, fix: "Build a small project with it and list it under Projects.", suggestedAction: `Start a ${missing[0] || "skill"} tutorial project this week.`, priority: "high", missingEvidence: "A project or job bullet using the skill", example: null },
      { category: "projects", problem: "Project descriptions lack impact", explanation: "Projects list technologies but not results.", impact: "Recruiters cannot judge scale or ownership.", fix: "Add what you built, the scale and the result.", suggestedAction: "Rewrite your top project's description.", priority: "high", missingEvidence: "Metrics or users", example: { before: "Built a web app using React.", after: "Built a React web app used by [N] students, cutting [task] time by [X%]." } },
      { category: "keywords", problem: "Summary does not name the target role", explanation: "The summary is generic.", impact: "ATS keyword matching is weaker.", fix: `Open the summary with "${role}" and your top 3 skills.`, suggestedAction: "Edit your summary line.", priority: "medium", missingEvidence: null, example: null },
    ],
  };
}

function mockRoadmap(ctx) {
  const needed = roleSkills(ctx);
  const have = haveSkills(ctx).map(normalizeText);
  const gaps = needed.filter((s) => !have.some((h) => h.includes(normalizeText(s))));
  const list = gaps.length ? gaps : needed;
  const chunks = [];
  for (let i = 0; i < list.length; i += 2) chunks.push(list.slice(i, i + 2));
  const stages = chunks.slice(0, 5).map((skills, i) => ({
    title: `${skills.join(" & ")}`,
    skills,
    reason: `Commonly required for ${ctx.user?.target_role || "the role"}.`,
    priority: i < 2 ? "high" : "medium",
    prerequisites: i === 0 ? [] : [chunks[i - 1].join(" & ")],
    topics: skills.map((s) => `${s} fundamentals`),
    expectedOutcome: `Use ${skills.join(" and ")} in a small project.`,
    estimatedTime: "3–4 weeks",
    estimatedHours: 40,
    projects: [{ title: `${skills[0]} mini project`, description: `A small app that exercises ${skills.join(" and ")}.` }],
    resources: [{ title: `${skills[0]} official documentation`, type: "docs", provider: null, url: null }],
    milestone: `Shipped one project using ${skills[0]}.`,
  }));
  stages.push({ title: "Portfolio projects", skills: ["Project delivery"], reason: "Proof of skills for recruiters.", priority: "high", prerequisites: [], topics: ["README writing", "Deployment"], expectedOutcome: "Two deployed projects.", estimatedTime: "4 weeks", estimatedHours: 48, projects: [], resources: [], milestone: "Two projects live with READMEs." });
  stages.push({ title: "Interview preparation", skills: ["DSA", "Communication"], reason: "Converts applications into offers.", priority: "medium", prerequisites: ["Portfolio projects"], topics: ["Common questions", "Mock interviews"], expectedOutcome: "Comfortable in technical interviews.", estimatedTime: "3 weeks", estimatedHours: 30, projects: [], resources: [], milestone: "Three mock interviews completed." });
  return {
    startingPoint: ctx.mode === "beginner" ? `Starting as ${ctx.user?.experience_level || "a beginner"} with ${(ctx.user?.current_skills || []).join(", ") || "no listed skills"}.` : "Starting from the skills evidenced on your resume.",
    summary: `Close the ${list.length} skill gaps for ${ctx.user?.target_role}, then build proof and prepare for interviews.`,
    totalEstimatedTime: "about 4–6 months at 10 hrs/week",
    stages,
    interviewPrep: { topics: ["Role fundamentals", "Project deep-dives"], tips: ["Practise explaining your projects out loud."] },
    readinessMilestones: [{ title: "Portfolio ready", criteria: "Two deployed projects with READMEs." }],
    generalTips: ["Apply while you learn; do not wait to feel 100% ready."],
  };
}

export function installMockAgent() {
  setMockHandler(async (messages, options) => {
    const all = textOf(messages);
    const task = options.task || "";
    if (task.startsWith("resume-parse")) return JSON.stringify(mockParse(all));
    const ctx = contextOf(all);
    if (task === "career-assessment") return JSON.stringify(mockAssessment(ctx));
    if (task === "career-improvements") return JSON.stringify(mockImprovements(ctx));
    if (task === "career-roadmap") return JSON.stringify(mockRoadmap(ctx));
    if (task === "profile-roadmap") return JSON.stringify({ input_mode: "goal_roadmap", target: {}, roadmap: { stages: [] } });
    throw new Error(`mock agent: unknown task ${task}`);
  });
}
