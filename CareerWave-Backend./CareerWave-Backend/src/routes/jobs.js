/** /jobs — ranked jobs from the web-parsing catalog for the signed-in user. */
import { Router } from "express";
import { asyncRoute, buildJobQuery, cleanList, cleanString } from "./helpers.js";

export function jobRoutes({ store, jobs }) {
  const r = Router();

  r.get("/jobs", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    const q = req.query;
    const query = buildJobQuery(user, {
      role: cleanString(q.role, 100) || undefined,
      locations: q.locations !== undefined ? cleanList(q.locations, { max: 10 }) : undefined,
      jobTypes: q.jobTypes !== undefined ? cleanList(q.jobTypes, { max: 6 }) : undefined,
      remote: q.remote !== undefined ? q.remote === "true" : undefined,
      limit: Math.min(60, Number(q.limit) || 30),
    });
    const result = await jobs.search(query);
    // Make sure there is a catalog for this role next time (no-op if fresh).
    const refreshing = jobs.requestScrape(query.role);
    const status = await jobs.status();
    res.json({
      ...result,
      query: { role: query.role, locations: query.locations, jobTypes: query.jobTypes, remote: query.remote },
      refreshing: refreshing || Boolean(status.scraping),
      scraperAvailable: status.scraperEnabled && status.pythonAvailable !== false,
    });
  }));

  r.post("/jobs/refresh", asyncRoute(async (req, res) => {
    const user = await store.getUser(req.user.sub);
    const role = user.preferences.jobSearch.role || user.profile.targetRole;
    const queued = jobs.requestScrape(role);
    res.status(202).json({ queued, status: await jobs.status() });
  }));

  r.get("/jobs/status", asyncRoute(async (_req, res) => res.json(await jobs.status())));

  return r;
}
