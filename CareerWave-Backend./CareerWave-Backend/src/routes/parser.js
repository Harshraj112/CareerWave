/**
 * Original Hecknex Resume Parser endpoints (/api/parse, /api/parse-profile,
 * /api/batch-parse, /api/info), kept available on the unified backend so
 * existing integrations and the Postman collection keep working.
 * They require the same authentication as every other route.
 */
import { Router } from "express";
import multer from "multer";
import { parseResumeFile, parseProfile, getSupportedMimeTypes, validateProfileInput } from "../../resume-parser/src/parser.js";
import { asyncRoute, httpError } from "./helpers.js";
import { detectMime } from "./resumes.js";

export function parserRoutes({ maxUploadBytes }) {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes } });

  r.get("/api/info", (_req, res) => {
    res.json({
      name: "Hecknex Resume Parser (Career Wave backend)",
      endpoints: { parse: "POST /api/parse", parseProfile: "POST /api/parse-profile", batchParse: "POST /api/batch-parse" },
      supportedFormats: getSupportedMimeTypes(),
    });
  });

  r.post("/api/parse", upload.single("file"), asyncRoute(async (req, res) => {
    if (!req.file) throw httpError(400, "No file provided");
    const mime = detectMime(req.file);
    if (!mime) throw httpError(400, `Unsupported file type. Supported types: ${getSupportedMimeTypes().join(", ")}`);
    const role = req.body.role || req.body.target || req.body.targetJob || req.body.jobRole || req.body.job_title || null;
    const extra = req.body.userData || req.body.user_data || req.body.profile || req.body.metadata || null;
    const data = await parseResumeFile(req.file.buffer, mime, null, role, extra ? String(extra) : null);
    res.json({ success: true, data, target: role });
  }));

  r.post("/api/parse-profile", asyncRoute(async (req, res) => {
    const payload = typeof req.body?.profile === "string" ? JSON.parse(req.body.profile) : req.body;
    try {
      validateProfileInput(payload || {});
    } catch (e) {
      throw httpError(400, e.message);
    }
    const data = await parseProfile({
      input_mode: "goal_roadmap",
      target: { stated_explicitly: true, target_description: payload.targetRole || payload.role || payload.target || null },
      starting_point: payload.experienceLevel || payload.experience || null,
      known_skills: Array.isArray(payload.skills) ? payload.skills : [],
    });
    res.json({ success: true, data });
  }));

  r.post("/api/batch-parse", upload.array("files", 10), asyncRoute(async (req, res) => {
    if (!req.files?.length) throw httpError(400, "No files provided");
    const results = [];
    const errors = [];
    for (const file of req.files) {
      const mime = detectMime(file);
      if (!mime) {
        errors.push({ filename: file.originalname, error: "Unsupported file type" });
        continue;
      }
      try {
        results.push({ filename: file.originalname, success: true, data: await parseResumeFile(file.buffer, mime) });
      } catch (e) {
        errors.push({ filename: file.originalname, error: e.message });
      }
    }
    res.json({ success: errors.length === 0, results, errors, summary: { total: req.files.length, successful: results.length, failed: errors.length } });
  }));

  return r;
}
