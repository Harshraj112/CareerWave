/**
 * api.ts — the ONLY place the frontend talks to the Career Wave backend.
 *
 * Backend: backend/src/server.js (VITE_API_URL). Auth: Auth0 Bearer token
 * injected by useCareerWaveApi(). No AI provider is ever called from here —
 * AgentRouter / OpenRouter keys live only on the server.
 *
 * Sections:
 *   1. transport (auth, errors, timeouts)
 *   2. state cache (localStorage mirror of GET /me/state — never authoritative)
 *   3. v2 API: profile, resume, assessment, improvements, roadmap, jobs, preferences
 *   4. legacy methods kept for existing callers (createAssessment, getJobMatches, …)
 */

import type {
  UserSession, ResumeSchema, RoleProfile, Assessment, LearningResource, JobMatch, ManualProfile, GapItem,
  CareerState, OnboardingProfile, ResumeRecord, ScoreOverview, ImprovementAnalysis, CareerRoadmap,
  RoadmapRequest, JobSearchResult, UserPreferences, JobSearchPreferences, NotificationPreferences, PublicConfig,
} from '../types';
import {
  SEEDED_ROLE_PROFILES, CURATED_LEARNING_RESOURCES, DEFAULT_FALLBACK_RESOURCES, DEMO_SAMPLE_RESUME,
} from '../data/mockData';
import { emptyState, legacyLocalAssessment, skillMatches, toLegacyResume, demoJobs } from './demoEngine';

// ── 1. Transport ─────────────────────────────────────────────────────────────

export const BASE_API_URL =
  ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080').replace(/\/+$/, '');

/** Explicit demo build: everything runs on local sample data. */
export const DEMO_MODE_ENV = import.meta.env.VITE_DEMO_MODE === 'true';

let _getToken: (() => Promise<string | null>) | null = null;

/** Auth0 token getter — injected by useCareerWaveApi(). */
export function setTokenGetter(getter: () => Promise<string | null>) {
  _getToken = getter;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) return { Authorization: `Bearer ${token}` };
    } catch (e) {
      console.warn('[api] Could not obtain Auth0 token:', e);
    }
  }
  return {};
}

export class ApiError extends Error {
  status: number;
  isNetwork: boolean;
  constructor(message: string, status = 0, isNetwork = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

const NETWORK_MESSAGE = "We can't reach Career Wave right now. Check your connection and try again.";

/** Readable message for any thrown value (UI uses this instead of raw errors). */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  timeoutMs?: number;
  query?: Record<string, string | string[] | boolean | number | undefined | null>;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = await authHeaders();
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let url = `${BASE_API_URL}${path}`;
  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined || v === null) continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new ApiError(aborted ? 'This is taking longer than expected. Please try again.' : NETWORK_MESSAGE, 0, !aborted);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!res.ok) {
    const serverMessage = (data as { message?: string } | null)?.message;
    let message = serverMessage || `Request failed (${res.status})`;
    if (res.status === 401) message = 'Your session has expired. Please sign in again.';
    else if (res.status >= 500 && !serverMessage) message = 'Something went wrong on our side. Please try again.';
    throw new ApiError(message, res.status);
  }
  return data as T;
}

/** AI calls can take a while with large models; give them room. */
const AI_TIMEOUT = 240000;

// ── 2. State cache ───────────────────────────────────────────────────────────

// Cache is namespaced per signed-in user so accounts on a shared browser never see each other's data.
let STATE_KEY = 'cw_state_v2';

/** Called once the Auth0 user is known. */
export function setCacheUser(sub: string | undefined) {
  STATE_KEY = sub ? `cw_state_v2:${sub}` : 'cw_state_v2';
}
const LEGACY_KEYS = ['rp_user_session', 'rp_current_resume', 'rp_current_assessment'];

function readCache(): CareerState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function writeCache(state: CareerState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — the backend still has the data */
  }
}

// ── In-memory state for legacy callers ───────────────────────────────────────

let currentSession: UserSession | null = null;
let currentRoadmapResources: LearningResource[] | null = null;

function legacyResumeShape(record: ResumeRecord) {
  return {
    id: record.id,
    file_path: `/storage/resumes/${record.originalFilename}`,
    original_filename: record.originalFilename,
    parsed_json: toLegacyResume(record),
  };
}

function toLegacyAssessment(a: ScoreOverview, userId: string): Assessment {
  const pct = (key: string) => {
    const b = a.scoreBreakdown.find((x) => x.key === key);
    return b ? Math.round((b.score / b.max) * 100) : 0;
  };
  const gap_list: GapItem[] = [
    ...a.skillsMissing.map((m) => ({ skill: m.skill, priority: m.importance, present: false, category: 'Missing' })),
    ...a.skillsMatched.map((m) => ({ skill: m.skill, priority: 'low' as const, present: true, category: 'Matched' })),
  ];
  return {
    id: a.id,
    user_id: userId,
    resume_id: a.resumeId ?? null,
    target_role_title: a.targetRole,
    match_score: a.atsScore,
    score_breakdown: {
      keyword_match: pct('role_keywords'),
      seniority_match: pct('experience_relevance'),
      required_skills_hit: pct('skills_coverage'),
    },
    gap_list,
    created_at: a.createdAt,
  };
}

function roadmapToResources(roadmap: CareerRoadmap): LearningResource[] {
  const out: LearningResource[] = [];
  roadmap.stages.forEach((stage) => {
    stage.resources.forEach((r) => {
      out.push({
        skill: stage.title,
        type: r.type === 'book' ? 'book' : r.type === 'course' || r.type === 'video' ? 'course' : 'doc',
        title: r.title,
        url: r.url ?? `https://www.google.com/search?q=${encodeURIComponent(r.title)}`,
        est_hours: Math.max(1, Math.round(stage.estimatedHours / Math.max(1, stage.resources.length))),
        description: r.provider ? `Provider: ${r.provider}` : stage.reason,
      });
    });
  });
  return out.length ? out : DEFAULT_FALLBACK_RESOURCES;
}

// ── 3 + 4. Service ───────────────────────────────────────────────────────────

export const ApiService = {
  // ════════════════════ v2: session state & profile ════════════════════

  /** Public health check; resolves false when the backend can't be reached. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_API_URL}/health`, { signal: AbortSignal.timeout(8000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  getConfig(): Promise<PublicConfig> {
    return request<PublicConfig>('GET', '/config');
  },

  /** Authoritative state from the backend; refreshes the local cache. */
  async getState(): Promise<CareerState> {
    const state = { ...emptyState(), ...(await request<CareerState>('GET', '/me/state')) };
    writeCache(state);
    return state;
  },

  /** Last known state for instant first paint. Replaced by getState() once it returns. */
  getCachedState(): CareerState | null {
    return readCache();
  },

  cacheState(state: CareerState) {
    writeCache(state);
  },

  clearLocalData() {
    localStorage.removeItem(STATE_KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    currentSession = null;
    currentRoadmapResources = null;
  },

  async saveProfile(patch: Partial<OnboardingProfile>): Promise<CareerState> {
    const state = { ...emptyState(), ...(await request<CareerState>('PUT', '/me/profile', { body: patch })) };
    writeCache(state);
    return state;
  },

  // ════════════════════ v2: resume → assessment → improvements → roadmap ════

  /** Upload to the Resume Parser. The onboarding target role is applied server-side. */
  uploadResumeFile(file: File, role?: string): Promise<ResumeRecord> {
    const form = new FormData();
    form.append('file', file);
    if (role?.trim()) form.append('role', role.trim());
    return request<ResumeRecord>('POST', '/resumes', { form, timeoutMs: AI_TIMEOUT });
  },

  runAssessment(targetRole?: string): Promise<ScoreOverview> {
    return request<ScoreOverview>('POST', '/assessments', { body: targetRole ? { targetRole } : {}, timeoutMs: AI_TIMEOUT });
  },

  generateImprovements(): Promise<ImprovementAnalysis> {
    return request<ImprovementAnalysis>('POST', '/analysis/improvements', { body: {}, timeoutMs: AI_TIMEOUT });
  },

  async generateCareerRoadmap(input: RoadmapRequest): Promise<CareerRoadmap> {
    const res = await request<CareerRoadmap & { career_roadmap?: CareerRoadmap }>('POST', '/roadmap', { body: input, timeoutMs: AI_TIMEOUT });
    return res.career_roadmap ?? res;
  },

  async setRoadmapStageComplete(stageId: string, completed: boolean): Promise<Record<string, string>> {
    const res = await request<{ progress: Record<string, string> }>('PATCH', '/roadmap/progress', { body: { stageId, completed } });
    return res.progress;
  },

  // ════════════════════ v2: jobs ════════════════════

  searchJobs(filters: Partial<JobSearchPreferences> = {}): Promise<JobSearchResult> {
    return request<JobSearchResult>('GET', '/jobs', {
      query: {
        role: filters.role ?? undefined,
        locations: filters.locations,
        jobTypes: filters.jobTypes,
        remote: filters.remote,
      },
      timeoutMs: 20000,
    });
  },

  refreshJobs(): Promise<{ queued: boolean }> {
    return request('POST', '/jobs/refresh', { body: {} });
  },

  // ════════════════════ v2: preferences & notifications ════════════════════

  savePreferences(patch: { jobSearch?: Partial<JobSearchPreferences>; notifications?: Partial<NotificationPreferences> }): Promise<UserPreferences> {
    return request<UserPreferences>('PUT', '/users/me/preferences', { body: patch });
  },

  sendTestNotification(): Promise<{ sent: boolean }> {
    return request('POST', '/users/me/notifications/test', { body: {} });
  },

  async deleteAccount(): Promise<void> {
    await request('DELETE', '/users/me');
    this.clearLocalData();
  },

  // ════════════════════ Legacy API (kept for existing callers) ════════════════════

  async createSession(name?: string, email?: string): Promise<UserSession> {
    const session: UserSession = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      name: name?.trim() || '',
      email: email?.trim() || '',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    };
    currentSession = session;
    localStorage.setItem('rp_user_session', JSON.stringify(session));
    return session;
  },

  getCurrentSession(): UserSession | null {
    if (currentSession) return currentSession;
    try {
      const stored = localStorage.getItem('rp_user_session');
      currentSession = stored ? JSON.parse(stored) : null;
    } catch {
      currentSession = null;
    }
    return currentSession;
  },

  /** Legacy: POST /resumes, mapped to { id, file_path, parsed_json }. sampleOverride = local demo resume. */
  async uploadResume(file: File, sampleOverride?: boolean, role?: string): Promise<{ id: string; file_path: string; parsed_json: ResumeSchema }> {
    if (sampleOverride) {
      return { id: 'res_demo', file_path: `/storage/resumes/${file.name}`, parsed_json: { ...DEMO_SAMPLE_RESUME } };
    }
    const record = await this.uploadResumeFile(file, role);
    return legacyResumeShape(record);
  },

  getCurrentResume() {
    const state = readCache();
    return state?.resume ? legacyResumeShape(state.resume) : null;
  },

  async deleteResume(resumeId: string): Promise<boolean> {
    await request('DELETE', `/resumes/${encodeURIComponent(resumeId)}`);
    const state = readCache();
    if (state) writeCache({ ...state, resume: null, assessment: null, improvements: null });
    return true;
  },

  /** Seeded role profiles — used only by the demo engine and legacy screens. */
  async getRoleProfiles(): Promise<RoleProfile[]> {
    return SEEDED_ROLE_PROFILES;
  },

  /** Legacy: beginner roadmap as a flat LearningResource list. */
  async generateRoadmap(targetRole: string, experienceLevel: string, skills: string[]): Promise<LearningResource[]> {
    const roadmap = await this.generateCareerRoadmap({ mode: 'beginner', targetRole, experienceLevel, skills });
    currentRoadmapResources = roadmapToResources(roadmap);
    return currentRoadmapResources;
  },

  getRoadmapResources(): LearningResource[] | null {
    return currentRoadmapResources;
  },

  /**
   * Legacy assessment. Now backed by the AI assessment on the server.
   * Falls back to the original local scoring ONLY when the backend is
   * unreachable or for the demo resume, and that result is never persisted
   * as the user's real score.
   */
  async createAssessment(payload: {
    user_id: string;
    resume_id?: string | null;
    target_role_title?: string;
    custom_jd_text?: string | null;
    manual_profile?: ManualProfile;
  }): Promise<Assessment> {
    const isDemo = DEMO_MODE_ENV || payload.resume_id === 'res_demo' || !payload.resume_id;
    if (!isDemo) {
      try {
        const a = await this.runAssessment(payload.target_role_title);
        return toLegacyAssessment(a, payload.user_id);
      } catch (e) {
        if (!(e instanceof ApiError && e.isNetwork)) throw e;
        console.warn('[api] backend unreachable — using local demo scoring (not saved)');
      }
    }
    const resume = this.getCurrentResume()?.parsed_json ?? (payload.resume_id === 'res_demo' ? DEMO_SAMPLE_RESUME : null);
    return legacyLocalAssessment(payload, resume);
  },

  getCurrentAssessment(): Assessment | null {
    const state = readCache();
    return state?.assessment ? toLegacyAssessment(state.assessment, this.getCurrentSession()?.id ?? 'me') : null;
  },

  /** Legacy: resources for missing skills (roadmap if available, else curated list). */
  async getLearningPath(gapList: GapItem[]): Promise<LearningResource[]> {
    const state = readCache();
    if (state?.roadmap) return roadmapToResources(state.roadmap);
    if (currentRoadmapResources?.length) return currentRoadmapResources;
    const resources: LearningResource[] = [];
    gapList.filter((g) => !g.present).forEach((g) => {
      const key = Object.keys(CURATED_LEARNING_RESOURCES).find((k) => skillMatches(g.skill, k));
      if (key) resources.push(...CURATED_LEARNING_RESOURCES[key]);
    });
    return resources.length ? resources : DEFAULT_FALLBACK_RESOURCES;
  },

  /** Legacy: job matches. Real scraped jobs from the backend; sample listings only if unreachable. */
  async getJobMatches(_userId: string, targetSkills: string[] = []): Promise<JobMatch[]> {
    let result: JobSearchResult;
    try {
      result = DEMO_MODE_ENV ? demoJobs(targetSkills) : await this.searchJobs();
    } catch (e) {
      if (!(e instanceof ApiError && e.isNetwork)) throw e;
      result = demoJobs(targetSkills);
    }
    return result.jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salary_range: j.salary || 'Not specified',
      required_skills: j.tags.slice(0, 6),
      fit_score: j.matchScore,
      raw_description: j.description,
      apply_url: j.link,
    }));
  },

  /** POST /users/me/job-alerts — sends matching jobs now (requires consent). */
  async triggerJobAlerts(): Promise<boolean> {
    try {
      const res = await request<{ sent: boolean }>('POST', '/users/me/job-alerts', { body: {} });
      return Boolean(res.sent);
    } catch (err) {
      console.warn('[api] triggerJobAlerts failed:', err);
      return false;
    }
  },

  /** PUT /users/me/telegram */
  async linkTelegram(chatId: string | null): Promise<boolean> {
    try {
      await request('PUT', '/users/me/telegram', { body: { chatId } });
      return true;
    } catch (err) {
      console.warn('[api] linkTelegram failed:', err);
      return false;
    }
  },

  /** PUT /users/me/whatsapp */
  async linkWhatsApp(phoneNumber: string | null): Promise<boolean> {
    try {
      await request('PUT', '/users/me/whatsapp', { body: { phoneNumber } });
      return true;
    } catch (err) {
      console.warn('[api] linkWhatsApp failed:', err);
      return false;
    }
  },

  /** Legacy digest trigger — no longer simulated; delegates to the real job-alerts endpoint. */
  async sendDigest(_userId: string, _emailOrHandle: string): Promise<boolean> {
    return this.triggerJobAlerts();
  },

  /** Wipes server data (when signed in) and every local copy. */
  async deleteUserData(_userId: string): Promise<boolean> {
    try {
      await this.deleteAccount();
    } finally {
      this.clearLocalData();
    }
    return true;
  },
};
