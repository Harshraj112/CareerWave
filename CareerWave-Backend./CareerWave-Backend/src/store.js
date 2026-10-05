/**
 * store.js — per-user persistence.
 *
 * One JSON document per user in DATA_DIR/users/<sha256(sub)>.json, written
 * atomically (temp file + rename) and serialised per user so concurrent
 * requests cannot interleave writes. This keeps the backend dependency-free;
 * swap this module for a database adapter with the same four functions
 * (getUser / updateUser / deleteUser / listUsers) when you outgrow it.
 *
 * The backend copy is the source of truth. The frontend caches it in
 * localStorage only to render instantly on refresh, then replaces the cache
 * with GET /me/state.
 */
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export function defaultUserRecord(sub) {
  const now = new Date().toISOString();
  return {
    userId: sub,
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "",
      email: null,
      targetRole: "",
      path: null, // "resume" | "beginner"
      experienceLevel: null,
      currentSkills: [],
      education: null,
      background: null,
      onboardingComplete: false,
      updatedAt: null,
    },
    resume: null,
    assessment: null,
    improvements: null,
    roadmap: null,
    roadmapProgress: {},
    preferences: {
      jobSearch: { role: null, locations: ["India"], remote: false, jobTypes: ["full-time"], updatedAt: null },
      notifications: {
        enabled: false,
        consent: false,
        consentAt: null,
        channel: null,
        telegramChatId: null,
        whatsappNumber: null,
        frequency: "weekly",
        lastSentAt: null,
        sentJobIds: [],
        updatedAt: null,
      },
    },
  };
}

function mergeDefaults(record, sub) {
  const base = defaultUserRecord(sub);
  return {
    ...base,
    ...record,
    profile: { ...base.profile, ...(record.profile || {}) },
    preferences: {
      jobSearch: { ...base.preferences.jobSearch, ...(record.preferences?.jobSearch || {}) },
      notifications: { ...base.preferences.notifications, ...(record.preferences?.notifications || {}) },
    },
    roadmapProgress: record.roadmapProgress || {},
  };
}

export function createStore(dataDir) {
  const usersDir = path.join(dataDir, "users");
  const locks = new Map();

  const fileFor = (sub) => path.join(usersDir, `${crypto.createHash("sha256").update(sub).digest("hex").slice(0, 40)}.json`);

  async function read(sub) {
    try {
      const raw = await fs.readFile(fileFor(sub), "utf8");
      return mergeDefaults(JSON.parse(raw), sub);
    } catch (err) {
      if (err.code === "ENOENT") return defaultUserRecord(sub);
      throw err;
    }
  }

  async function write(sub, record) {
    await fs.mkdir(usersDir, { recursive: true });
    const file = fileFor(sub);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
    await fs.rename(tmp, file);
  }

  function withLock(sub, fn) {
    const previous = locks.get(sub) || Promise.resolve();
    const run = previous.then(fn);
    // The lock chain must never reject (the caller handles run's rejection).
    const settled = run.then(() => {}, () => {});
    locks.set(sub, settled);
    settled.then(() => {
      if (locks.get(sub) === settled) locks.delete(sub);
    });
    return run;
  }

  return {
    getUser: (sub) => read(sub),

    /** mutator(record) may modify the record in place or return a new one. */
    updateUser(sub, mutator) {
      return withLock(sub, async () => {
        const current = await read(sub);
        const next = (await mutator(current)) || current;
        next.updatedAt = new Date().toISOString();
        await write(sub, next);
        return next;
      });
    },

    deleteUser(sub) {
      return withLock(sub, async () => {
        await fs.rm(fileFor(sub), { force: true });
      });
    },

    async listUsers() {
      let files = [];
      try {
        files = await fs.readdir(usersDir);
      } catch (err) {
        if (err.code === "ENOENT") return [];
        throw err;
      }
      const records = [];
      for (const f of files.filter((name) => name.endsWith(".json"))) {
        try {
          const record = JSON.parse(await fs.readFile(path.join(usersDir, f), "utf8"));
          records.push(mergeDefaults(record, record.userId));
        } catch {
          /* skip unreadable file */
        }
      }
      return records;
    },
  };
}

/** The slice of a user record the frontend is allowed to see. */
export function publicState(record) {
  const notifications = { ...record.preferences.notifications };
  delete notifications.sentJobIds;
  return {
    profile: record.profile,
    resume: record.resume,
    assessment: record.assessment,
    improvements: record.improvements,
    roadmap: record.roadmap,
    roadmapProgress: record.roadmapProgress,
    preferences: { jobSearch: record.preferences.jobSearch, notifications },
    updatedAt: record.updatedAt,
  };
}
