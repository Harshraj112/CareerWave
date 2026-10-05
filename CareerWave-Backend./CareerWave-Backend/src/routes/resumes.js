/**
 * /resumes — upload → Resume Parser → stored structured resume.
 *
 * Response shape is the one the frontend already maps
 * ({ id, originalFilename, uploadedAt, parsedData: { input_mode, resume_data, target, warnings } }).
 * Scoring is a separate call (POST /assessments) so the UI can show
 * "Reading your resume…" and "Scoring it for <role>…" as distinct steps.
 */
import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { parseResumeFile, getSupportedMimeTypes } from "../../resume-parser/src/parser.js";
import { asyncRoute, cleanString, httpError } from "./helpers.js";

const EXT_MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function detectMime(file) {
  const supported = getSupportedMimeTypes();
  if (supported.includes(file.mimetype)) return file.mimetype;
  const ext = String(file.originalname || "").split(".").pop().toLowerCase();
  return EXT_MIME[ext] || null;
}

export function resumeRoutes({ store, maxUploadBytes }) {
  const r = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });

  r.post("/resumes", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") return next(httpError(413, `That file is too large. The limit is ${Math.round(maxUploadBytes / 1048576)} MB.`));
      if (err) return next(err);
      next();
    });
  }, asyncRoute(async (req, res) => {
    if (!req.file) throw httpError(400, "Choose a resume file to upload.");
    if (/\.doc$/i.test(req.file.originalname)) throw httpError(415, "Old .doc files aren't supported. Save it as PDF or DOCX and upload again.");
    const mimeType = detectMime(req.file);
    if (!mimeType) throw httpError(415, "Upload a PDF, DOCX, TXT or an image (PNG/JPG) of your resume.");

    const user = await store.getUser(req.user.sub);
    // The role from onboarding is used automatically; an explicit field only overrides it.
    const role = cleanString(req.body?.role, 100) || user.profile.targetRole || null;
    const extraContext = JSON.stringify({ name: user.profile.name || undefined, target_role: role || undefined });

    const parsed = await parseResumeFile(req.file.buffer, mimeType, null, role, extraContext);

    if (parsed?.input_mode && parsed.input_mode !== "resume_analysis") {
      throw httpError(422, "This file doesn't look like a resume. Upload your CV, or choose \"I'm new\" to get a roadmap instead.");
    }
    const resumeData = parsed.resume_data || parsed; // tolerate a bare resume object
    const resume = {
      id: `res_${crypto.randomBytes(6).toString("hex")}`,
      originalFilename: cleanString(req.file.originalname, 200) || "resume",
      mimeType,
      sizeBytes: req.file.size,
      uploadedAt: new Date().toISOString(),
      targetRole: role,
      parsedData: {
        input_mode: "resume_analysis",
        target: parsed.target || { stated_explicitly: Boolean(role), target_description: role },
        resume_data: resumeData,
        warnings: parsed.warnings || [],
        clarification_needed: parsed.clarification_needed || [],
      },
    };

    await store.updateUser(req.user.sub, (u) => {
      u.resume = resume;
      // Analyses describe the previous resume; they are regenerated from this one.
      u.assessment = null;
      u.improvements = null;
      if (u.roadmap?.mode === "resume") u.roadmap = null;
      u.profile.path = "resume";
      const name = resumeData?.personal_info?.full_name;
      if (!u.profile.name && name) u.profile.name = cleanString(name, 80);
    });
    // The raw file is not kept — only the structured data.
    res.status(201).json(resume);
  }));

  r.get("/resumes/current", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    if (!user.resume) throw httpError(404, "No resume uploaded yet.");
    res.json(user.resume);
  }));

  r.delete("/resumes/:id", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    if (!user.resume || user.resume.id !== req.params.id) throw httpError(404, "Resume not found.");
    await store.updateUser(req.user.sub, (u) => {
      u.resume = null;
      u.assessment = null;
      u.improvements = null;
      if (u.roadmap?.mode === "resume") u.roadmap = null;
    });
    res.status(204).end();
  }));

  return r;
}
