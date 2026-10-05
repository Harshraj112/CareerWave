import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { parseResumeFile, getSupportedMimeTypes, validateProfileInput } from "./parser.js";
import { isProviderConfigured, describeProvider, getProviderConfig } from "./ai-provider.js";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PORT = process.env.PORT || 3000;
// Provider keys are read inside ai-provider.js (AI_PROVIDER=agentrouter|openrouter).
// const API_KEY = process.env.OPENROUTER_API_KEY;   // original OpenRouter-only key
const API_KEY = getProviderConfig().apiKey;

function normalizeGoalProfile(payload = {}) {
  validateProfileInput(payload);

  const rawTarget =
    payload.targetRole ||
    payload.target ||
    payload.role ||
    payload.jobRole ||
    payload.job_title ||
    payload.target_description ||
    null;

  const rawExperience =
    payload.experienceLevel ||
    payload.experience_level ||
    payload.level ||
    payload.experience ||
    null;

  const rawSkills = Array.isArray(payload.skills)
    ? payload.skills
    : Array.isArray(payload.knownSkills)
      ? payload.knownSkills
      : typeof payload.skills === "string"
        ? payload.skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : typeof payload.knownSkills === "string"
          ? payload.knownSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

  return {
    input_mode: "goal_roadmap",
    target: {
      stated_explicitly: Boolean(rawTarget),
      target_description: rawTarget ? String(rawTarget) : null,
      inference_basis: rawTarget ? "user provided target role" : null,
    },
    starting_point: rawExperience ? String(rawExperience) : null,
    known_skills: rawSkills,
  };
}

if (!isProviderConfigured()) {
  const { provider } = describeProvider();
  console.error(`ERROR: AI provider "${provider}" is not configured — set ${provider === "openrouter" ? "OPENROUTER_API_KEY" : "AGENTROUTER_API_KEY"} in .env`);
  process.exit(1);
}

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Hecknex Resume Parser is running", ai: describeProvider() });
});

/**
 * Parse resume endpoint
 * POST /api/parse
 * Body: multipart/form-data with 'file' field containing resume
 */
app.post("/api/parse", upload.single("file"), async (req, res) => {
  try {

    
    if (!req.file) {
      return res.status(400).json({
        error: "No file provided",
        message: "Please upload a resume file",
      });
    }

    const supportedTypes = getSupportedMimeTypes();
    if (!supportedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "Unsupported file type",
        message: `Supported types: ${supportedTypes.join(", ")}`,
      });
    }

    const role =
      req.body.role ||
      req.body.target ||
      req.body.targetJob ||
      req.body.jobRole ||
      req.body.job_title ||
      null;

    const extraContext = (() => {
      const candidates = [
        req.body.userData,
        req.body.user_data,
        req.body.profile,
        req.body.profileData,
        req.body.targetData,
        req.body.metadata,
      ];

      for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate === "string") {
          try {
            return JSON.stringify(JSON.parse(candidate), null, 2);
          } catch {
            return candidate;
          }
        }
        return JSON.stringify(candidate, null, 2);
      }
      return null;
    })();

    const parsed = await parseResumeFile(
      req.file.buffer,
      req.file.mimetype,
      API_KEY,
      role,
      extraContext
    );

    res.json({
      success: true,
      data: parsed,
      target: role || null,
      userContext: extraContext ? JSON.parse(extraContext) : null,
    });
  } catch (error) {
    console.error("Parse error:", error);
    res.status(500).json({
      error: "Failed to parse resume",
      message: error.message,
    });
  }
});

app.post("/api/parse-profile", async (req, res) => {
  try {
    let payload = req.body;

    if (typeof req.body?.profile === "string") {
      try {
        payload = JSON.parse(req.body.profile);
      } catch {
        return res.status(400).json({
          error: "Invalid profile JSON",
          message: "The profile field must be valid JSON.",
        });
      }
    } else if (typeof req.body?.data === "string") {
      try {
        payload = JSON.parse(req.body.data);
      } catch {
        return res.status(400).json({
          error: "Invalid profile JSON",
          message: "The data field must be valid JSON.",
        });
      }
    }

    const { parseProfile } = await import("./parser.js");

    try {
      validateProfileInput(payload || {});
    } catch (validationError) {
      return res.status(400).json({
        error: "Missing profile fields",
        message: validationError.message,
        accepted_fields: ["targetRole", "target", "role", "experienceLevel", "experience", "skills", "knownSkills"],
      });
    }

    const normalized = normalizeGoalProfile(payload || {});

    if (!normalized.target.target_description && !normalized.starting_point && normalized.known_skills.length === 0) {
      return res.status(400).json({
        error: "Missing profile fields",
        message: "Send only target role, experience level, and optional skills.",
        accepted_fields: ["targetRole", "target", "role", "experienceLevel", "experience", "skills", "knownSkills"],
      });
    }
    const parsed = await parseProfile(normalized, API_KEY);
    res.json({ success: true, data: parsed, normalized_profile: normalized });
  } catch (error) {
    console.error("Profile parse error:", error);
    res.status(500).json({
      error: "Failed to parse profile",
      message: error.message || "Unexpected server error while parsing profile.",
    });
  }
});

/**
 * Batch parse endpoint
 * POST /api/batch-parse
 * Body: multipart/form-data with multiple 'files' fields
 */
app.post("/api/batch-parse", upload.array("files"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No files provided",
        message: "Please upload at least one resume file",
      });
    }

    const supportedTypes = getSupportedMimeTypes();
    const results = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      if (!supportedTypes.includes(file.mimetype)) {
        errors.push({
          filename: file.originalname,
          error: "Unsupported file type",
          mimetype: file.mimetype,
        });
        continue;
      }

      try {
        const parsed = await parseResumeFile(file.buffer, file.mimetype, API_KEY);
        results.push({
          filename: file.originalname,
          success: true,
          data: parsed,
        });
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message,
        });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: req.files.length,
        successful: results.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error("Batch parse error:", error);
    res.status(500).json({
      error: "Batch parse failed",
      message: error.message,
    });
  }
});

/**
 * Get info endpoint
 * GET /api/info
 */
app.get("/api/info", (req, res) => {
  res.json({
    name: "Hecknex Resume Parser",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      parse: "POST /api/parse (single file)",
      batchParse: "POST /api/batch-parse (multiple files)",
      info: "GET /api/info",
    },
    supportedFormats: getSupportedMimeTypes(),
    documentation: "https://github.com/yourusername/hecknex-resume-parser",
  });
});

/**
 * Root endpoint
 */
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Hecknex Resume Parser API",
    getStarted: "Visit /api/info for API documentation",
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);

  res.status(err.status || 500).json({
    error: "Something went wrong",
    message: err.message || "Please try again later or contact support.",
  });
});

/**
 * Start server
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Hecknex Resume Parser API listening on port ${PORT}`);
  console.log(`📖 Documentation: http://localhost:${PORT}/api/info`);
});
