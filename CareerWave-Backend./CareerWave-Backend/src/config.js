/**
 * config.js — every environment variable the gateway reads, in one place.
 * Loaded once at startup (dotenv runs in server.js before this is imported).
 */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, "..");

const bool = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};
const num = (value, fallback) => (Number.isFinite(Number(value)) && value !== "" ? Number(value) : fallback);

export function loadConfig(env = process.env) {
  const webParsingDir = path.resolve(BACKEND_ROOT, env.WEB_PARSING_DIR || "web-parsing");
  return {
    port: num(env.PORT, 8080),
    nodeEnv: env.NODE_ENV || "development",
    corsOrigins: (env.CORS_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean),
    dataDir: path.resolve(BACKEND_ROOT, env.DATA_DIR || "data"),
    maxUploadBytes: num(env.MAX_UPLOAD_MB, 10) * 1024 * 1024,

    auth: {
      disabled: bool(env.AUTH_DISABLED, false),
      domain: (env.AUTH0_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
      audience: env.AUTH0_AUDIENCE || "",
    },

    jobs: {
      webParsingDir,
      outputDir: path.join(webParsingDir, "output"),
      scraperScript: path.join(webParsingDir, "scrape_india_jobs.py"),
      pythonBin: env.PYTHON_BIN || "python3",
      scraperEnabled: bool(env.SCRAPER_ENABLED, true),
      scrapeIntervalHours: num(env.SCRAPE_INTERVAL_HOURS, 48),
      scrapeOnStartup: bool(env.SCRAPE_ON_STARTUP, true),
      defaultSearchTerm: env.DEFAULT_SEARCH_TERM || "software engineer",
      defaultLocation: env.DEFAULT_JOB_LOCATION || "India",
    },

    notifications: {
      // Set NOTIFICATION_SERVICE_URL to use an externally deployed notification-service.
      // Otherwise the gateway starts web-parsing/notification-service itself.
      serviceUrl: (env.NOTIFICATION_SERVICE_URL || "").replace(/\/+$/, ""),
      manage: bool(env.MANAGE_NOTIFICATION_SERVICE, true),
      managedPort: num(env.NOTIFICATION_SERVICE_PORT, 8001),
      serviceDir: path.join(webParsingDir, "notification-service"),
      schedulerEnabled: bool(env.ALERT_SCHEDULER_ENABLED, true),
      schedulerIntervalMinutes: num(env.ALERT_SCHEDULER_INTERVAL_MINUTES, 30),
      jobsPerAlert: num(env.JOBS_PER_ALERT, 5),
      telegramBotUsername: env.TELEGRAM_BOT_USERNAME || "",
    },
  };
}
