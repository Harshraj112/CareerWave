/**
 * notificationService.js — bridge to web-parsing/notification-service (FastAPI).
 *
 * The Telegram / WhatsApp senders stay in Python, unchanged in spirit. The
 * gateway either talks to an already-deployed instance (NOTIFICATION_SERVICE_URL)
 * or starts it as a child process on 127.0.0.1 (MANAGE_NOTIFICATION_SERVICE=true),
 * with its own background scraper turned off because the gateway schedules
 * scraping per role.
 *
 * Nothing is ever sent unless the user has explicitly consented, chosen a
 * channel and supplied a recipient. The scheduler re-checks this every run.
 */
import { spawn } from "child_process";

export function createNotificationService(cfg) {
  let baseUrl = cfg.serviceUrl;
  let child = null;
  let restarts = 0;
  let channelsCache = { at: 0, value: null };

  function startManaged() {
    if (baseUrl || !cfg.manage) return;
    const port = String(cfg.managedPort);
    const pythonBin = process.env.PYTHON_BIN || "python3";
    try {
      child = spawn(pythonBin, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", port], {
        cwd: cfg.serviceDir,
        env: { ...process.env, ENABLE_BACKGROUND_SCRAPER: "false", PORT: port },
      });
    } catch (err) {
      console.warn(`[notify] could not start notification-service: ${err.message}`);
      return;
    }
    baseUrl = `http://127.0.0.1:${port}`;
    child.stdout.on("data", (d) => process.stdout.write(`[notification-service] ${d}`));
    child.stderr.on("data", (d) => process.stdout.write(`[notification-service] ${d}`));
    child.on("error", (err) => {
      console.warn(`[notify] notification-service unavailable (${err.code || err.message}). Install Python deps: pip install -r requirements.txt`);
      baseUrl = "";
      child = null;
    });
    child.on("exit", (code) => {
      if (code === null || child === null) return;
      console.warn(`[notify] notification-service exited with code ${code}`);
      child = null;
      baseUrl = "";
      if (restarts < 3) {
        restarts += 1;
        setTimeout(startManaged, 5000 * restarts);
      }
    });
  }

  async function call(pathname, body) {
    if (!baseUrl) {
      throw Object.assign(new Error("Job alerts are temporarily unavailable. Please try again later."), { status: 503, code: "NOTIFY_UNAVAILABLE" });
    }
    let res;
    try {
      res = await fetch(`${baseUrl}${pathname}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(45000),
      });
    } catch (err) {
      throw Object.assign(new Error("Job alerts are temporarily unavailable. Please try again later."), { status: 503, cause: err });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = res.status === 503
        ? `${body?.channel === "whatsapp" ? "WhatsApp" : "Telegram"} alerts are not set up on this server yet.`
        : `We couldn't deliver the message. Check that your ${body?.channel === "whatsapp" ? "WhatsApp number" : "Telegram chat ID"} is correct.`;
      throw Object.assign(new Error(message), { status: res.status === 503 ? 503 : 502, detail: data?.message });
    }
    return data;
  }

  function toPayload(job) {
    return {
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary || "",
      source: job.source,
      link: job.link,
      credibility_score: job.credibility,
      confidence_score: job.credibility,
      posted_date: job.postedDate,
      scraped_at: job.scrapedAt,
      tags: job.matchReasons?.join(", ") || null,
    };
  }

  return {
    start: startManaged,
    stop() {
      if (child) {
        const c = child;
        child = null;
        c.kill("SIGTERM");
      }
    },
    available: () => Boolean(baseUrl),
    async channels() {
      if (!baseUrl) return { telegram: false, whatsapp: false };
      if (Date.now() - channelsCache.at < 60000 && channelsCache.value) return channelsCache.value;
      try {
        const value = await call("/api/notifications/channels");
        channelsCache = { at: Date.now(), value };
        return value;
      } catch {
        return { telegram: false, whatsapp: false };
      }
    },
    sendJobs(channel, recipient, jobs) {
      return call("/api/notifications/send", { channel, recipient, jobs: jobs.map(toPayload) });
    },
    sendText(channel, recipient, message) {
      return call("/api/notifications/send", { channel, recipient, message, jobs: [] });
    },
  };
}

export function recipientFor(n) {
  if (n.channel === "telegram") return n.telegramChatId;
  if (n.channel === "whatsapp") return n.whatsappNumber;
  return null;
}

export function canNotify(n) {
  return Boolean(n && n.enabled && n.consent && n.channel && recipientFor(n));
}

const FREQUENCY_MS = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000 };

/**
 * Periodically sends a digest of new, relevant jobs to each opted-in user.
 * Also asks the jobs service to refresh catalogs for every targeted role.
 */
export function createAlertScheduler({ store, jobs, notify, buildJobQuery, cfg }) {
  let timer = null;
  let running = false;

  async function sendDigest(record, { force = false } = {}) {
    const n = record.preferences.notifications;
    if (!canNotify(n)) throw Object.assign(new Error("Turn on job alerts and confirm your permission first."), { status: 409 });
    const due = !n.lastSentAt || Date.now() - Date.parse(n.lastSentAt) >= (FREQUENCY_MS[n.frequency] || FREQUENCY_MS.weekly) - 5 * 60 * 1000;
    if (!force && !due) return { sent: false, reason: "not_due" };

    const query = buildJobQuery(record, {});
    const { jobs: ranked } = await jobs.search({ ...query, limit: 40 });
    const seen = new Set(n.sentJobIds || []);
    const fresh = ranked.filter((j) => !seen.has(j.id) && j.matchScore >= 35).slice(0, cfg.jobsPerAlert);
    if (!fresh.length) return { sent: false, reason: "no_new_jobs" };

    await notify.sendJobs(n.channel, recipientFor(n), fresh);
    await store.updateUser(record.userId, (u) => {
      u.preferences.notifications.lastSentAt = new Date().toISOString();
      u.preferences.notifications.sentJobIds = [...fresh.map((j) => j.id), ...(u.preferences.notifications.sentJobIds || [])].slice(0, 500);
    });
    return { sent: true, jobsSent: fresh.length, channel: n.channel };
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      const users = await store.listUsers();
      jobs.refreshRoles(users.map((u) => u.preferences.jobSearch.role || u.profile.targetRole));
      for (const u of users) {
        if (!canNotify(u.preferences.notifications)) continue;
        try {
          const result = await sendDigest(u);
          if (result.sent) console.log(`[alerts] sent ${result.jobsSent} jobs to a ${result.channel} subscriber`);
        } catch (err) {
          console.warn(`[alerts] digest failed: ${err.message}`);
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    sendDigest,
    start() {
      if (!cfg.schedulerEnabled) return;
      timer = setInterval(() => tick().catch((e) => console.warn("[alerts]", e.message)), cfg.schedulerIntervalMinutes * 60 * 1000);
      setTimeout(() => tick().catch(() => {}), 15000);
    },
    stop() {
      if (timer) clearInterval(timer);
    },
    tick,
  };
}
