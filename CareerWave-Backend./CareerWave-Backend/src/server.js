/**
 * Career Wave backend — one service for the whole product.
 *
 *   Frontend (React, Auth0)  ──HTTPS──▶  this gateway
 *     ├─ /me, /me/profile               onboarding profile + persisted state
 *     ├─ /resumes                       Resume Parser (resume-parser/src/parser.js)
 *     ├─ /assessments, /analysis/*      career agent (AI provider: AgentRouter | OpenRouter)
 *     ├─ /roadmap                       career agent (resume + beginner modes)
 *     ├─ /jobs                          web-parsing catalog (scrape_india_jobs.py)
 *     ├─ /users/me/*                    preferences, Telegram/WhatsApp, job alerts
 *     │                                   → web-parsing/notification-service (FastAPI)
 *     └─ /api/*                         original Hecknex parser endpoints
 *
 * All AI keys stay here; the React app never sees them.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const { default: express } = await import("express");
const { loadConfig } = await import("./config.js");
const { createAuthMiddleware } = await import("./auth.js");
const { createStore } = await import("./store.js");
const { createJobsService } = await import("./services/jobsService.js");
const { createNotificationService, createAlertScheduler } = await import("./services/notificationService.js");
const { describeProvider, isProviderConfigured } = await import("../resume-parser/src/ai-provider.js");
const { meRoutes } = await import("./routes/me.js");
const { resumeRoutes } = await import("./routes/resumes.js");
const { analysisRoutes } = await import("./routes/analysis.js");
const { jobRoutes } = await import("./routes/jobs.js");
const { notificationRoutes } = await import("./routes/notifications.js");
const { parserRoutes } = await import("./routes/parser.js");
const { buildJobQuery } = await import("./routes/helpers.js");

export async function createApp(config = loadConfig(), { startBackground = true } = {}) {
  if (describeProvider().provider === "mock") {
    const { installMockAgent } = await import("./ai/mockAgent.js");
    installMockAgent();
    console.warn("⚠️  AI_PROVIDER=mock — results are deterministic test data, not AI analysis.");
  } else if (!isProviderConfigured()) {
    console.warn(`⚠️  AI provider "${describeProvider().provider}" has no API key — resume parsing and analysis will return 503.`);
  }

  const store = createStore(config.dataDir);
  const jobs = createJobsService(config.jobs);
  const notify = createNotificationService(config.notifications);
  const scheduler = createAlertScheduler({ store, jobs, notify, buildJobQuery, cfg: config.notifications });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // CORS (explicit allow-list in production via CORS_ORIGINS)
  app.use((req, res, next) => {
    const origin = req.get("origin");
    const allowAll = config.corsOrigins.includes("*");
    if (origin && (allowAll || config.corsOrigins.includes(origin))) {
      res.set("Access-Control-Allow-Origin", allowAll ? "*" : origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Dev-User");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.set("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app.use(express.json({ limit: "2mb" }));

  // ── Public ────────────────────────────────────────────────────────────────
  app.get("/health", async (_req, res) => {
    res.json({
      status: "ok",
      ai: describeProvider(),
      jobs: await jobs.status(),
      notifications: { available: notify.available(), channels: await notify.channels() },
    });
  });
  app.get("/config", async (_req, res) => {
    res.json({
      telegramBotUsername: config.notifications.telegramBotUsername || null,
      notificationChannels: await notify.channels(),
      aiProvider: describeProvider().provider,
      aiConfigured: isProviderConfigured(),
    });
  });

  // ── Authenticated ─────────────────────────────────────────────────────────
  app.use(createAuthMiddleware(config.auth));
  app.use(meRoutes({ store }));
  app.use(resumeRoutes({ store, maxUploadBytes: config.maxUploadBytes }));
  app.use(analysisRoutes({ store }));
  app.use(jobRoutes({ store, jobs }));
  app.use(notificationRoutes({ store, notify, scheduler, jobs, telegramBotUsername: config.notifications.telegramBotUsername }));
  app.use(parserRoutes({ maxUploadBytes: config.maxUploadBytes }));

  app.use((req, res) => res.status(404).json({ error: "not_found", message: `Endpoint not found: ${req.method} ${req.path}` }));

  // Errors: friendly message for the UI, details in the server log only.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(`[${req.method} ${req.path}]`, err.message, err.raw ? `\n  raw: ${err.raw}` : "");
    let message = err.message;
    if (err.code === "AI_NOT_CONFIGURED") message = "The analysis service isn't configured yet. Please try again later.";
    else if (status === 502 && /API error|not valid JSON|Invalid response/i.test(message)) {
      message = "The AI service couldn't complete this request. Please try again in a moment.";
    } else if (status >= 500 && status !== 503) message = "Something went wrong on our side. Please try again.";
    else if (err.type === "entity.parse.failed") message = "Invalid JSON body.";
    res.status(status).json({ error: err.code || "error", message });
  });

  if (startBackground) {
    notify.start();
    await jobs.init();
    scheduler.start();
  }

  return { app, store, jobs, notify, scheduler };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const config = loadConfig();
  const { app, notify, scheduler } = await createApp(config);
  const server = app.listen(config.port, "0.0.0.0", () => {
    const ai = describeProvider();
    console.log(`🌊 Career Wave backend on http://localhost:${config.port}`);
    console.log(`   AI provider: ${ai.provider} (${ai.model}, ${ai.apiStyle}) ${ai.configured ? "✓" : "✗ not configured"}`);
    console.log(`   Auth: ${config.auth.disabled ? "DISABLED (dev)" : `Auth0 ${config.auth.domain}`}`);
  });
  const shutdown = () => {
    scheduler.stop();
    notify.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
