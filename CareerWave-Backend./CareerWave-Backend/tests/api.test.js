/**
 * End-to-end API tests for the unified backend.
 * Runs fully offline: AI_PROVIDER=mock, auth disabled, scraper and
 * notification-service off, data in a temp directory.
 *
 *   npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "careerwave-test-"));
Object.assign(process.env, {
  AI_PROVIDER: "mock",
  AUTH_DISABLED: "true",
  DATA_DIR: tmp,
  SCRAPER_ENABLED: "false",
  MANAGE_NOTIFICATION_SERVICE: "false",
  NOTIFICATION_SERVICE_URL: "",
  ALERT_SCHEDULER_ENABLED: "false",
  LOG_LLM_RESPONSES: "false",
});

const { createApp } = await import("../src/server.js");
const { loadConfig } = await import("../src/config.js");
const { normalizeAssessment } = await import("../src/ai/normalize.js");
const { verifyAuth0Token } = await import("../src/auth.js");
const { rankJobs } = await import("../src/services/jobsService.js");

let server;
let base;

before(async () => {
  const { app } = await createApp(loadConfig(), { startBackground: false });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function api(method, url, { user = "alice", body, form } = {}) {
  const headers = { "X-Dev-User": user };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const RESUME = `Priya Sharma
priya.sharma@example.com | +91 98765 43210
Final-year B.Tech Computer Science student building web apps with React, JavaScript, HTML and CSS.
Experience
Frontend Developer Intern at PixelCraft — built dashboard pages in React and Git workflows
Projects
Project: Expense tracker in React with REST APIs
Education
B.Tech Computer Science, ABC Institute of Technology`;

test("health is public and reports the AI provider", async () => {
  const res = await fetch(`${base}/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ai.provider, "mock");
});

test("resume journey: profile → upload → score → improvements → roadmap", async () => {
  let r = await api("PUT", "/me/profile", { body: { name: "Priya Sharma", targetRole: "Frontend Developer", onboardingComplete: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.targetRole, "Frontend Developer");

  // Upload WITHOUT a role field: the onboarding role must be used automatically.
  const form = new FormData();
  form.append("file", new Blob([RESUME], { type: "text/plain" }), "priya.txt");
  r = await api("POST", "/resumes", { form });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.targetRole, "Frontend Developer");
  assert.equal(r.body.parsedData.input_mode, "resume_analysis");
  assert.ok(r.body.parsedData.resume_data.skills.technical.includes("React"));
  const resumeId = r.body.id;

  r = await api("POST", "/assessments", { body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = r.body;
  assert.equal(a.atsScore, a.scoreBreakdown.reduce((s, b) => s + b.score, 0));
  assert.equal(a.scoreBreakdown.length, 5);
  assert.equal(a.targetRole, "Frontend Developer");
  assert.equal(a.source, "mock");
  assert.ok(a.skillsMissing.length > 0);

  r = await api("POST", "/analysis/improvements", { body: {} });
  assert.equal(r.status, 200);
  assert.ok(r.body.items.length >= 1);
  assert.ok(r.body.items.every((i) => i.problem && i.fix && ["high", "medium", "low"].includes(i.priority)));

  r = await api("POST", "/roadmap", { body: { mode: "resume" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, "resume");
  assert.ok(r.body.stages.length >= 3);
  assert.ok(r.body.roadmap.stages[0].stage_name, "legacy roadmap contract still present");

  r = await api("PATCH", "/roadmap/progress", { body: { stageId: "stage-1", completed: true } });
  assert.equal(r.status, 200);
  assert.ok(r.body.progress["stage-1"]);

  r = await api("GET", "/me/state");
  assert.equal(r.body.resume.id, resumeId);
  assert.ok(r.body.assessment && r.body.improvements && r.body.roadmap);
  assert.equal(r.body.profile.path, "resume");
});

test("changing target role makes the next analysis use the new role", async () => {
  await api("PUT", "/me/profile", { body: { targetRole: "Backend Developer" } });
  const r = await api("POST", "/analysis/improvements", { body: {} });
  assert.equal(r.status, 200);
  const state = await api("GET", "/me/state");
  assert.equal(state.body.assessment.targetRole, "Backend Developer", "stale assessment regenerated");
});

test("beginner journey: no resume, roadmap from level + skills, no score", async () => {
  await api("PUT", "/me/profile", { user: "bob", body: { name: "Bob", targetRole: "Backend Developer", onboardingComplete: true } });
  const r = await api("POST", "/roadmap", {
    user: "bob",
    body: { mode: "beginner", experienceLevel: "Beginner / Student", skills: ["Python"] },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.mode, "beginner");
  const state = await api("GET", "/me/state", { user: "bob" });
  assert.equal(state.body.assessment, null, "no ATS score for users without a resume");
  assert.equal(state.body.profile.path, "beginner");
  assert.deepEqual(state.body.profile.currentSkills, ["Python"]);
});

test("assessment without a resume is refused", async () => {
  const r = await api("POST", "/assessments", { user: "carol", body: {} });
  assert.equal(r.status, 409);
});

test("non-resume uploads are rejected with a clear message", async () => {
  const form = new FormData();
  form.append("file", new Blob(["x"], { type: "application/zip" }), "a.zip");
  const r = await api("POST", "/resumes", { user: "carol", form });
  assert.equal(r.status, 415);
});

test("jobs are ranked from the scraped catalog for the user's role", async () => {
  await api("PUT", "/me/profile", { user: "dave", body: { targetRole: "Java Developer" } });
  const r = await api("GET", "/jobs?locations=India", { user: "dave" });
  assert.equal(r.status, 200);
  assert.ok(r.body.catalogSize > 0);
  assert.ok(r.body.jobs.length > 0);
  assert.ok(/java/i.test(r.body.jobs[0].title), r.body.jobs[0].title);
  assert.ok(r.body.jobs[0].matchReasons.length > 0);
});

test("alerts require explicit consent, channel and recipient", async () => {
  let r = await api("PUT", "/users/me/preferences", { user: "erin", body: { notifications: { channel: "whatsapp", whatsappNumber: "9876543210", enabled: true } } });
  assert.equal(r.status, 400, "cannot enable without consent");

  r = await api("POST", "/users/me/job-alerts", { user: "erin" });
  assert.equal(r.status, 409);

  r = await api("PUT", "/users/me/preferences", {
    user: "erin",
    body: { notifications: { channel: "whatsapp", whatsappNumber: "98765 43210", consent: true, enabled: true, frequency: "daily" } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.notifications.whatsappNumber, "919876543210");
  assert.equal(r.body.notifications.enabled, true);

  // Notification service is not running in tests → honest 503, never fake success.
  r = await api("POST", "/users/me/notifications/test", { user: "erin" });
  assert.equal(r.status, 503);

  r = await api("PUT", "/users/me/preferences", { user: "erin", body: { notifications: { consent: false } } });
  assert.equal(r.body.notifications.enabled, false, "withdrawing consent disables alerts");
});

test("legacy /users/me/telegram and /users/me/whatsapp still work", async () => {
  let r = await api("PUT", "/users/me/telegram", { user: "frank", body: { chatId: "731049965" } });
  assert.equal(r.status, 200);
  r = await api("PUT", "/users/me/telegram", { user: "frank", body: { chatId: "@not-a-chat-id" } });
  assert.equal(r.status, 400);
  r = await api("PUT", "/users/me/whatsapp", { user: "frank", body: { phoneNumber: "+44 7700 900123" } });
  assert.equal(r.status, 200);
});

test("DELETE /users/me wipes all stored data", async () => {
  await api("PUT", "/me/profile", { user: "gina", body: { name: "Gina", targetRole: "QA Engineer" } });
  let r = await api("DELETE", "/users/me", { user: "gina" });
  assert.equal(r.status, 204);
  r = await api("GET", "/me/state", { user: "gina" });
  assert.equal(r.body.profile.name, "");
});

// ── Unit tests ──────────────────────────────────────────────────────────────

test("normalizeAssessment makes the score equal its breakdown and clamps values", () => {
  const a = normalizeAssessment(
    { atsScore: 99, scoreBreakdown: [{ key: "role_keywords", score: 40 }, { key: "skills_coverage", score: 10 }], skillsMissing: ["Docker"] },
    { source: "ai" }
  );
  assert.equal(a.scoreBreakdown.find((b) => b.key === "role_keywords").score, 25);
  assert.equal(a.atsScore, 35);
  assert.equal(a.scoreLabel, "Needs work");
  assert.equal(a.skillsMissing[0].skill, "Docker");
});

test("Auth0 RS256 tokens are verified against the JWKS", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }));
  try {
    const sign = (claims) => {
      const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k1" })).toString("base64url");
      const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const s = crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey).toString("base64url");
      return `${h}.${p}.${s}`;
    };
    const cfg = { domain: "t.auth0.com", audience: "https://api" };
    const now = Math.floor(Date.now() / 1000);
    const claims = await verifyAuth0Token(sign({ iss: "https://t.auth0.com/", aud: ["https://api"], sub: "auth0|1", exp: now + 60 }), cfg);
    assert.equal(claims.sub, "auth0|1");
    await assert.rejects(verifyAuth0Token(sign({ iss: "https://t.auth0.com/", aud: "other", sub: "x", exp: now + 60 }), cfg), /audience/);
    await assert.rejects(verifyAuth0Token(sign({ iss: "https://t.auth0.com/", aud: "https://api", sub: "x", exp: now - 3600 }), cfg), /expired/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("rankJobs prefers role + level fit and filters location and type", () => {
  const job = (o) => ({ id: o.title, company: "C", location: "Bengaluru, Karnataka, India", source: "linkedin", link: "https://x", tags: [], description: "", credibility: 80, isRemote: false, postedDate: null, ...o });
  const jobs = [
    job({ title: "Senior Frontend Engineer" }),
    job({ title: "Frontend Developer Intern" }),
    job({ title: "Accountant" }),
    job({ title: "React Developer", location: "Pune, Maharashtra" }),
  ];
  const ranked = rankJobs(jobs, { role: "Frontend Developer", locations: ["Bengaluru"], jobTypes: [], skills: ["React"], experienceLevel: "Beginner / Student" });
  assert.deepEqual(ranked.map((j) => j.title), ["Frontend Developer Intern", "Senior Frontend Engineer"]);
  const interns = rankJobs(jobs, { role: "Frontend Developer", locations: [], jobTypes: ["internship"], skills: [], experienceLevel: "entry" });
  assert.deepEqual(interns.map((j) => j.title), ["Frontend Developer Intern"]);
});
