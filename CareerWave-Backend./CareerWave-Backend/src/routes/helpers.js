/** Small helpers shared by the route modules. */
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

export function cleanString(value, max = 200) {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

export function cleanList(value, { max = 40, itemMax = 60 } = {}) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(list.map((v) => cleanString(v, itemMax)).filter(Boolean))].slice(0, max);
}

/** Skills the user has, from the best available source. */
export function userSkills(record) {
  const rs = record.resume?.parsedData?.resume_data?.skills;
  const fromResume = rs ? [...(rs.technical || []), ...(rs.tools || [])] : [];
  const matched = (record.assessment?.skillsMatched || []).map((s) => s.skill);
  return [...new Set([...fromResume, ...matched, ...(record.profile.currentSkills || [])])];
}

/** Job search query for a user, with optional overrides from the request. */
export function buildJobQuery(record, overrides = {}) {
  const js = record.preferences.jobSearch;
  return {
    role: overrides.role || js.role || record.profile.targetRole,
    locations: overrides.locations || js.locations,
    remote: overrides.remote ?? js.remote,
    jobTypes: overrides.jobTypes || js.jobTypes,
    skills: userSkills(record),
    experienceLevel: record.profile.experienceLevel || record.assessment?.experienceLevel || "entry",
    limit: overrides.limit || 30,
  };
}
