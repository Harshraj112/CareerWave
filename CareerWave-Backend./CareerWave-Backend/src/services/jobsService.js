/**
 * jobsService.js — job discovery for Career Wave.
 *
 * Scraping stays in web-parsing/scrape_india_jobs.py (JobSpy is Python-only).
 * This service:
 *   1. reads the scraped catalog (output/india_jobs.json + output/roles/*.json)
 *      WITHOUT consuming it — the notification queue semantics are untouched;
 *   2. ranks and filters jobs for one user (target role, locations, job types,
 *      skills, experience level);
 *   3. runs the scraper on a schedule and on demand for each target role users
 *      actually have, so a "Data Analyst" user is not shown only the default
 *      "software engineer" catalog.
 */
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { normalizeText, resolveRole, experienceBucket, slugify } from "../data/roles.js";

const CITY_ALIASES = {
  bengaluru: ["bengaluru", "bangalore", "karnataka", "ka, in"],
  bangalore: ["bengaluru", "bangalore", "karnataka", "ka, in"],
  mumbai: ["mumbai", "bombay", "maharashtra", "mh, in"],
  pune: ["pune", "maharashtra", "mh, in"],
  delhi: ["delhi", "new delhi", "ncr", "dl, in"],
  "delhi ncr": ["delhi", "new delhi", "ncr", "gurgaon", "gurugram", "noida", "hr, in", "dl, in", "up, in"],
  gurgaon: ["gurgaon", "gurugram", "haryana", "hr, in"],
  gurugram: ["gurgaon", "gurugram", "haryana", "hr, in"],
  noida: ["noida", "uttar pradesh", "up, in"],
  hyderabad: ["hyderabad", "telangana", "tg, in", "ts, in"],
  chennai: ["chennai", "tamil nadu", "tn, in"],
  kolkata: ["kolkata", "calcutta", "west bengal", "wb, in"],
  ahmedabad: ["ahmedabad", "gujarat", "gj, in"],
};

const SOURCE_TRUST = { linkedin: 18, indeed: 16, naukri: 16, glassdoor: 14, google: 10 };

/** Same rule as compute_credibility() in scrape_india_jobs.py, for older catalog files. */
function credibility(job) {
  let score = 40 + (SOURCE_TRUST[job.source] ?? 6);
  if (job.company && job.company !== "Unknown") score += 12;
  if (job.location && job.location !== "Not specified") score += 6;
  if (job.postedDate) score += 8;
  if (job.salary) score += 6;
  if (String(job.link).startsWith("https://")) score += 6;
  if ((job.description || "").length > 200) score += 4;
  return Math.min(100, score);
}

function normalizeJob(raw) {
  const link = String(raw.link || "").trim();
  const tags = String(raw.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && t !== "Not specified");
  const posted = raw.posted_date && raw.posted_date !== "Not specified" ? String(raw.posted_date) : null;
  const job = {
    id: crypto.createHash("sha1").update(link || `${raw.title}|${raw.company}`).digest("hex").slice(0, 12),
    title: String(raw.title || "Untitled role"),
    company: String(raw.company || "Unknown"),
    location: String(raw.location || "Not specified"),
    salary: raw.salary && raw.salary !== "Not specified" ? String(raw.salary) : null,
    postedDate: posted,
    source: String(raw.source || "unknown").toLowerCase(),
    link,
    tags,
    description: String(raw.description || ""),
    jobType: raw.job_type || tags.find((t) => /fulltime|parttime|internship|contract/i.test(t)) || null,
    jobLevel: raw.job_level || tags.find((t) => /level|entry|associate|senior|internship/i.test(t)) || null,
    isRemote: Boolean(raw.is_remote) || /remote|work from home/i.test(`${raw.location} ${raw.title}`),
    scrapedAt: raw.scraped_at || null,
  };
  job.credibility = credibility(job);
  return job;
}

// ── Matching helpers ─────────────────────────────────────────────────────────

function seniorityOf(title, level) {
  const t = normalizeText(`${title} ${level || ""}`);
  if (/\b(intern|internship|trainee|apprentice)\b/.test(t)) return "intern";
  if (/\b(junior|jr|fresher|graduate|entry|associate|i)\b/.test(t) && !/\bii\b|\biii\b/.test(t)) return "junior";
  if (/\b(principal|staff|architect|director|head|vp|manager|lead)\b/.test(t)) return "lead";
  if (/\b(senior|sr|iii|mid senior)\b/.test(t)) return "senior";
  return "mid";
}

const FIT = {
  beginner: { intern: 15, junior: 12, mid: 2, senior: -15, lead: -25 },
  entry: { intern: 10, junior: 15, mid: 8, senior: -10, lead: -20 },
  mid: { intern: -10, junior: 4, mid: 15, senior: 10, lead: -5 },
  senior: { intern: -20, junior: -8, mid: 8, senior: 15, lead: 12 },
};

function locationMatches(job, locations, remote) {
  const prefs = (locations || []).map((l) => normalizeText(l)).filter(Boolean);
  const loc = normalizeText(job.location);
  if (remote && job.isRemote) return { ok: true, reason: "Remote" };
  if (!prefs.length) return { ok: true, reason: null };
  for (const pref of prefs) {
    if (pref === "remote") {
      if (job.isRemote) return { ok: true, reason: "Remote" };
      continue;
    }
    if (pref === "india" || pref === "anywhere in india") {
      if (!/\b(usa|united states|uk|singapore|germany|canada|uae)\b/.test(loc)) return { ok: true, reason: null };
      continue;
    }
    if (pref === "international" || pref === "abroad") {
      if (loc && !/\b(india|in)\b/.test(loc) && !/, in$/.test(loc)) return { ok: true, reason: job.location };
      continue;
    }
    const aliases = CITY_ALIASES[pref] || [pref];
    if (aliases.some((a) => loc.includes(a))) return { ok: true, reason: job.location };
  }
  return { ok: false, reason: null };
}

const TYPE_TESTS = {
  "full-time": (j) => /full ?time|fulltime/i.test(`${j.jobType} ${j.tags.join(" ")}`) || (!j.jobType && !/intern/i.test(j.title)),
  internship: (j) => /intern/i.test(`${j.title} ${j.jobType} ${j.jobLevel}`),
  "part-time": (j) => /part ?time/i.test(`${j.jobType} ${j.tags.join(" ")}`),
  contract: (j) => /contract|freelance/i.test(`${j.jobType} ${j.title} ${j.tags.join(" ")}`),
  "entry-level": (j) => ["intern", "junior"].includes(seniorityOf(j.title, j.jobLevel)) || /entry/i.test(j.jobLevel || ""),
  graduate: (j) => /graduate|fresher|campus|trainee|new grad/i.test(`${j.title} ${j.description.slice(0, 400)}`) || seniorityOf(j.title, j.jobLevel) === "junior",
};

function roleScore(job, roleText) {
  const title = normalizeText(job.title);
  const role = normalizeText(roleText);
  if (!role) return { score: 10, reason: null };
  if (title.includes(role)) return { score: 45, reason: `Title matches ${roleText}` };
  const lib = resolveRole(roleText);
  if (lib && lib.key !== "swe" && lib.match.some((m) => title.includes(m))) return { score: 38, reason: `${lib.title} role` };
  const words = role.split(" ").filter((w) => w.length > 2 && !["developer", "engineer", "and"].includes(w));
  const hits = words.filter((w) => title.includes(w));
  if (hits.length) return { score: 18 + 8 * hits.length, reason: `Title mentions ${hits.join(", ")}` };
  if (lib && lib.key === "swe" && /(engineer|developer|sde)/.test(title)) return { score: 25, reason: "Software engineering role" };
  if (lib && lib.skills.some((s) => normalizeText(`${job.title} ${job.description}`).includes(normalizeText(s)))) return { score: 8, reason: null };
  return { score: 0, reason: null };
}

function ageDays(postedDate) {
  if (!postedDate) return null;
  const t = Date.parse(postedDate);
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86400000) : null;
}

/**
 * @param {object[]} jobs normalized catalog
 * @param {{ role:string, locations:string[], remote:boolean, jobTypes:string[], skills:string[], experienceLevel:string, limit:number }} q
 */
export function rankJobs(jobs, q) {
  const skills = [...new Set((q.skills || []).map((s) => String(s).trim()).filter((s) => s.length > 1))];
  const bucket = experienceBucket(q.experienceLevel);
  const typeTests = (q.jobTypes || []).map((t) => TYPE_TESTS[t]).filter(Boolean);

  const ranked = [];
  for (const job of jobs) {
    const loc = locationMatches(job, q.locations, q.remote);
    if (!loc.ok) continue;
    if (typeTests.length && !typeTests.some((test) => test(job))) continue;

    const role = roleScore(job, q.role);
    const haystack = normalizeText(`${job.title} ${job.tags.join(" ")} ${job.description}`);
    const skillHits = skills.filter((s) => {
      const n = normalizeText(s);
      return n.length > 1 && new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(haystack);
    });
    if (role.score === 0 && skillHits.length === 0) continue; // unrelated job

    const seniority = seniorityOf(job.title, job.jobLevel);
    const fit = FIT[bucket][seniority];
    const days = ageDays(job.postedDate);
    const fresh = days === null ? 2 : days <= 7 ? 6 : days <= 21 ? 3 : 0;

    const raw = role.score + Math.min(25, skillHits.length * 6) + fit + fresh + Math.round((job.credibility - 50) / 6);
    const matchScore = Math.max(1, Math.min(99, Math.round(raw * 1.15)));

    const reasons = [];
    if (role.reason) reasons.push(role.reason);
    if (skillHits.length) reasons.push(`Mentions ${skillHits.slice(0, 4).join(", ")}`);
    if (loc.reason) reasons.push(loc.reason);
    if (fit >= 12) reasons.push(seniority === "intern" ? "Internship" : "Fits your experience level");
    if (fit < 0) reasons.push(`Likely needs more experience (${seniority} level)`);

    ranked.push({ ...job, description: job.description.slice(0, 400), matchScore, matchReasons: reasons, seniority });
  }
  ranked.sort((a, b) => b.matchScore - a.matchScore || b.credibility - a.credibility);
  return ranked.slice(0, q.limit || 30);
}

// ── Catalog + scraper ────────────────────────────────────────────────────────

export function createJobsService(cfg) {
  let cache = { key: "", jobs: [], updatedAt: null, files: 0 };
  const scrapeState = { running: null, queue: [], lastRun: {}, lastError: null, pythonAvailable: null };

  async function catalogFiles() {
    const files = [path.join(cfg.outputDir, "india_jobs.json")];
    try {
      const roleDir = path.join(cfg.outputDir, "roles");
      for (const f of await fs.readdir(roleDir)) {
        if (f.endsWith(".json") && !f.endsWith("_summary.json")) files.push(path.join(roleDir, f));
      }
    } catch {
      /* no role catalogs yet */
    }
    return files;
  }

  async function loadCatalog() {
    const files = await catalogFiles();
    const stats = await Promise.all(files.map((f) => fs.stat(f).then((s) => ({ f, m: s.mtimeMs })).catch(() => null)));
    const present = stats.filter(Boolean);
    const key = present.map((s) => `${s.f}:${s.m}`).join("|");
    if (key === cache.key) return cache;

    const byId = new Map();
    for (const { f } of present) {
      try {
        const records = JSON.parse(await fs.readFile(f, "utf8"));
        if (!Array.isArray(records)) continue;
        for (const r of records) {
          if (!r || typeof r !== "object" || !r.title) continue;
          if (r.company === "Example" || String(r.link).startsWith("https://example.com/")) continue;
          const job = normalizeJob(r);
          if (!byId.has(job.id)) byId.set(job.id, job);
        }
      } catch (err) {
        console.warn(`[jobs] could not read ${f}: ${err.message}`);
      }
    }
    const newest = present.length ? new Date(Math.max(...present.map((s) => s.m))).toISOString() : null;
    cache = { key, jobs: [...byId.values()], updatedAt: newest, files: present.length };
    return cache;
  }

  function runScraper(job) {
    return new Promise((resolve) => {
      const args = [
        cfg.scraperScript,
        "--search-term", job.searchTerm,
        "--location", job.location || cfg.defaultLocation,
        "--output-name", job.outputName,
        "--results-wanted", String(job.resultsWanted || 60),
      ];
      if (job.jobType) args.push("--job-type", job.jobType);
      console.log(`[jobs] scraping "${job.searchTerm}" → output/${job.outputName}.json`);
      let stderr = "";
      let child;
      try {
        child = spawn(cfg.pythonBin, args, { cwd: cfg.webParsingDir, env: process.env });
      } catch (err) {
        scrapeState.pythonAvailable = false;
        return resolve({ ok: false, error: err.message });
      }
      const timer = setTimeout(() => child.kill("SIGTERM"), 30 * 60 * 1000);
      child.stdout.on("data", (d) => process.stdout.write(`[scraper] ${d}`));
      child.stderr.on("data", (d) => { stderr += d; });
      child.on("error", (err) => {
        clearTimeout(timer);
        scrapeState.pythonAvailable = false;
        resolve({ ok: false, error: `${cfg.pythonBin} not available (${err.code || err.message})` });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          scrapeState.pythonAvailable = true;
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: stderr.trim().split("\n").slice(-3).join(" ") || `exit ${code}` });
        }
      });
    });
  }

  async function drain() {
    if (scrapeState.running) return;
    while (scrapeState.queue.length) {
      const job = scrapeState.queue.shift();
      scrapeState.running = job;
      const result = await runScraper(job);
      scrapeState.lastRun[job.outputName] = { at: Date.now(), ok: result.ok, error: result.error || null };
      if (!result.ok) {
        scrapeState.lastError = result.error;
        console.warn(`[jobs] scrape failed for "${job.searchTerm}": ${result.error}`);
      }
    }
    scrapeState.running = null;
  }

  /** Queue a scrape for a role unless one ran recently. Returns true if queued. */
  function requestScrape(role, { force = false, jobType = null } = {}) {
    if (!cfg.scraperEnabled || scrapeState.pythonAvailable === false) return false;
    const searchTerm = String(role || cfg.defaultSearchTerm).slice(0, 80);
    const isDefault = normalizeText(searchTerm) === normalizeText(cfg.defaultSearchTerm);
    const outputName = isDefault ? "india_jobs" : `roles/${slugify(searchTerm)}`;
    const last = scrapeState.lastRun[outputName];
    const fresh = last && Date.now() - last.at < cfg.scrapeIntervalHours * 3600 * 1000;
    if (!force && fresh) return false;
    if (scrapeState.running?.outputName === outputName || scrapeState.queue.some((q) => q.outputName === outputName)) return false;
    scrapeState.queue.push({ searchTerm, outputName, jobType, location: cfg.defaultLocation, resultsWanted: isDefault ? 100 : 60 });
    drain();
    return true;
  }

  async function seedLastRunFromDisk() {
    for (const f of await catalogFiles()) {
      try {
        const st = await fs.stat(f);
        const rel = path.relative(cfg.outputDir, f).replace(/\\/g, "/").replace(/\.json$/, "");
        scrapeState.lastRun[rel] = { at: st.mtimeMs, ok: true, error: null };
      } catch {
        /* ignore */
      }
    }
  }

  return {
    rankJobs,
    async init() {
      await seedLastRunFromDisk();
      if (cfg.scraperEnabled && cfg.scrapeOnStartup) requestScrape(cfg.defaultSearchTerm);
    },
    async search(q) {
      const catalog = await loadCatalog();
      const jobs = rankJobs(catalog.jobs, q);
      return { jobs, catalogSize: catalog.jobs.length, catalogUpdatedAt: catalog.updatedAt };
    },
    requestScrape,
    async status() {
      const catalog = await loadCatalog();
      return {
        catalogSize: catalog.jobs.length,
        catalogUpdatedAt: catalog.updatedAt,
        scraperEnabled: cfg.scraperEnabled,
        scraping: scrapeState.running ? scrapeState.running.searchTerm : null,
        queued: scrapeState.queue.map((q) => q.searchTerm),
        pythonAvailable: scrapeState.pythonAvailable,
        lastError: scrapeState.lastError,
      };
    },
    /** Re-scrape every role currently targeted by users (called by the scheduler). */
    refreshRoles(roles) {
      requestScrape(cfg.defaultSearchTerm);
      [...new Set(roles.filter(Boolean))].forEach((r) => requestScrape(r));
    },
  };
}
