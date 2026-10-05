/**
 * /me — session state, onboarding profile, data deletion.
 */
import { Router } from "express";
import { publicState } from "../store.js";
import { asyncRoute, cleanString, cleanList, httpError } from "./helpers.js";
import { EXPERIENCE_LEVELS } from "../ai/normalize.js";

export function meRoutes({ store }) {
  const r = Router();

  r.get("/me/state", asyncRoute(async (req, res) => {
    const record = await store.getUser(req.user.sub);
    res.json(publicState(record));
  }));

  r.put("/me/profile", asyncRoute(async (req, res) => {
    const b = req.body || {};
    if (b.name !== undefined && !cleanString(b.name, 80)) throw httpError(400, "Please enter your name.");
    if (b.targetRole !== undefined && !cleanString(b.targetRole, 100)) throw httpError(400, "Please choose the role you're targeting.");
    if (b.path !== undefined && b.path !== null && !["resume", "beginner"].includes(b.path)) throw httpError(400, "Invalid path.");

    const record = await store.updateUser(req.user.sub, (u) => {
      const p = u.profile;
      if (b.name !== undefined) p.name = cleanString(b.name, 80);
      if (b.email !== undefined) p.email = cleanString(b.email, 120);
      if (b.targetRole !== undefined) p.targetRole = cleanString(b.targetRole, 100);
      if (b.path !== undefined) p.path = b.path;
      if (b.experienceLevel !== undefined) {
        p.experienceLevel = EXPERIENCE_LEVELS.includes(b.experienceLevel) ? b.experienceLevel : cleanString(b.experienceLevel, 60);
      }
      if (b.currentSkills !== undefined) p.currentSkills = cleanList(b.currentSkills);
      if (b.background !== undefined) p.background = cleanString(b.background, 600);
      if (b.education !== undefined) {
        const e = b.education || {};
        p.education = e.degree || e.institution
          ? { degree: cleanString(e.degree, 120), institution: cleanString(e.institution, 160), graduationYear: cleanString(e.graduationYear, 10) }
          : null;
      }
      if (b.onboardingComplete !== undefined) p.onboardingComplete = Boolean(b.onboardingComplete);
      if (!u.profile.email && req.user.email) p.email = req.user.email;
      p.updatedAt = new Date().toISOString();
    });
    res.json(publicState(record));
  }));

  // Wipe everything the backend holds for this user.
  r.delete("/users/me", asyncRoute(async (req, res) => {
    await store.deleteUser(req.user.sub);
    res.status(204).end();
  }));

  return r;
}
