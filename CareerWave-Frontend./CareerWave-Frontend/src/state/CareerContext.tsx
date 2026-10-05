/**
 * CareerContext — the one state container for the signed-in experience.
 *
 * Persistence rule: the backend (GET /me/state) is the source of truth.
 * localStorage holds a mirror only so the UI can paint instantly after a
 * refresh; as soon as the backend answers, its data replaces the cache, so
 * stale local data can never override newer server data.
 *
 * Demo mode ("Try with a sample resume", or VITE_DEMO_MODE=true) keeps its
 * resume / analysis in a separate local slot and never writes it to the
 * backend, so sample results can't be mistaken for the user's real results.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CareerState, OnboardingProfile, RoadmapRequest, JobSearchPreferences, NotificationPreferences, UserPreferences,
} from '../types';
import { ApiService, ApiError, DEMO_MODE_ENV, setCacheUser } from '../services/api';
import { emptyState, demoResumeRecord, demoAssessment, demoImprovements, demoRoadmap } from '../services/demoEngine';

type BackendStatus = 'checking' | 'online' | 'offline';
const DEMO_KEY = 'cw_demo_state_v2';

interface CareerContextValue {
  state: CareerState;
  /** Name from Auth0, used only to pre-fill the onboarding name field. */
  suggestedName: string;
  loading: boolean;
  backend: BackendStatus;
  demo: boolean;
  refresh: () => Promise<void>;
  saveProfile: (patch: Partial<OnboardingProfile>) => Promise<void>;
  uploadResume: (file: File, onStage?: (stage: 'parsing' | 'scoring') => void) => Promise<void>;
  runAssessment: () => Promise<void>;
  generateImprovements: () => Promise<void>;
  generateRoadmap: (input: RoadmapRequest) => Promise<void>;
  setStageComplete: (stageId: string, completed: boolean) => Promise<void>;
  savePreferences: (patch: { jobSearch?: Partial<JobSearchPreferences>; notifications?: Partial<NotificationPreferences> }) => Promise<UserPreferences>;
  startDemo: () => void;
  exitDemo: () => Promise<void>;
  wipeAll: () => Promise<void>;
}

const CareerContext = createContext<CareerContextValue | null>(null);

function readDemo(): CareerState | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function CareerProvider({ userId, authName, authEmail, children }: { userId?: string; authName?: string; authEmail?: string; children: React.ReactNode }) {
  // Must run before the first cache read below.
  setCacheUser(userId);
  const [state, setStateRaw] = useState<CareerState>(() => readDemo() || ApiService.getCachedState() || emptyState());
  const [demo, setDemo] = useState<boolean>(() => DEMO_MODE_ENV || Boolean(readDemo()));
  const [loading, setLoading] = useState(!DEMO_MODE_ENV);
  const [backend, setBackend] = useState<BackendStatus>(DEMO_MODE_ENV ? 'offline' : 'checking');
  // Mirrors `demo` for use inside async callbacks; updated wherever setDemo is called.
  const demoRef = useRef(demo);

  const setState = useCallback((next: CareerState | ((s: CareerState) => CareerState)) => {
    setStateRaw((prev) => {
      const value = typeof next === 'function' ? (next as (s: CareerState) => CareerState)(prev) : next;
      if (demoRef.current) localStorage.setItem(DEMO_KEY, JSON.stringify(value));
      else ApiService.cacheState(value);
      return value;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const server = await ApiService.getState();
      setBackend('online');
      if (demoRef.current) {
        // Keep sample analysis, but take the real profile/preferences from the server.
        setState((s) => ({ ...s, profile: server.profile, preferences: server.preferences }));
      } else {
        setState(server);
      }
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) setBackend('offline');
      else throw e;
    }
  }, [setState]);

  useEffect(() => {
    if (DEMO_MODE_ENV) return;
    refresh().catch((e) => console.warn('[career] state load failed', e)).finally(() => setLoading(false));
  }, [refresh]);

  const saveProfile = useCallback(async (patch: Partial<OnboardingProfile>) => {
    if (DEMO_MODE_ENV) {
      setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
      return;
    }
    const server = await ApiService.saveProfile({ ...patch, email: patch.email ?? authEmail ?? undefined });
    setBackend('online');
    setState((s) => (demoRef.current ? { ...s, profile: server.profile } : server));
  }, [setState, authEmail]);

  const uploadResume = useCallback(async (file: File, onStage?: (stage: 'parsing' | 'scoring') => void) => {
    onStage?.('parsing');
    const resume = await ApiService.uploadResumeFile(file);
    if (demoRef.current) {
      localStorage.removeItem(DEMO_KEY);
      setDemo(false);
      demoRef.current = false;
    }
    setState((s) => ({ ...s, resume, assessment: null, improvements: null, roadmap: s.roadmap?.mode === 'resume' ? null : s.roadmap, profile: { ...s.profile, path: 'resume' } }));
    onStage?.('scoring');
    const assessment = await ApiService.runAssessment();
    setState((s) => ({
      ...s,
      assessment,
      profile: { ...s.profile, experienceLevel: s.profile.experienceLevel || assessment.experienceLevel },
    }));
  }, [setState]);

  const runAssessment = useCallback(async () => {
    if (demoRef.current) {
      setState((s) => (s.resume ? { ...s, assessment: demoAssessment(s.resume, s.profile.targetRole), improvements: null } : s));
      return;
    }
    const assessment = await ApiService.runAssessment();
    setState((s) => ({ ...s, assessment, improvements: null }));
  }, [setState]);

  const generateImprovements = useCallback(async () => {
    if (demoRef.current) {
      setState((s) => (s.assessment ? { ...s, improvements: demoImprovements(s.assessment) } : s));
      return;
    }
    const improvements = await ApiService.generateImprovements();
    // The server may have refreshed a stale assessment on the way; pick it up.
    await refresh();
    setState((s) => ({ ...s, improvements }));
  }, [setState, refresh]);

  const generateRoadmap = useCallback(async (input: RoadmapRequest) => {
    if (demoRef.current) {
      setState((s) => {
        const known = input.mode === 'beginner'
          ? input.skills
          : s.assessment?.skillsMatched.map((m) => m.skill) || [];
        return { ...s, roadmap: demoRoadmap(s.profile.targetRole, known, input.mode), roadmapProgress: {} };
      });
      return;
    }
    const roadmap = await ApiService.generateCareerRoadmap(input);
    await refresh();
    setState((s) => ({ ...s, roadmap, roadmapProgress: {} }));
  }, [setState, refresh]);

  const setStageComplete = useCallback(async (stageId: string, completed: boolean) => {
    const apply = (progress: Record<string, string>) => setState((s) => ({ ...s, roadmapProgress: progress }));
    const optimistic = { ...state.roadmapProgress };
    if (completed) optimistic[stageId] = new Date().toISOString();
    else delete optimistic[stageId];
    apply(optimistic);
    if (demoRef.current) return;
    try {
      apply(await ApiService.setRoadmapStageComplete(stageId, completed));
    } catch (e) {
      apply(state.roadmapProgress); // roll back
      throw e;
    }
  }, [setState, state.roadmapProgress]);

  const savePreferences = useCallback(async (patch: { jobSearch?: Partial<JobSearchPreferences>; notifications?: Partial<NotificationPreferences> }) => {
    const prefs = await ApiService.savePreferences(patch);
    setState((s) => ({ ...s, preferences: prefs }));
    return prefs;
  }, [setState]);

  const startDemo = useCallback(() => {
    const role = state.profile.targetRole || 'Frontend Developer';
    const resume = demoResumeRecord(role);
    const next: CareerState = {
      ...state,
      resume,
      assessment: demoAssessment(resume, role),
      improvements: null,
      roadmap: null,
      roadmapProgress: {},
      profile: { ...state.profile, path: 'resume', targetRole: role },
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(next));
    demoRef.current = true;
    setDemo(true);
    setStateRaw(next);
  }, [state]);

  const exitDemo = useCallback(async () => {
    localStorage.removeItem(DEMO_KEY);
    demoRef.current = false;
    setDemo(false);
    setStateRaw(ApiService.getCachedState() || emptyState());
    await refresh().catch(() => {});
  }, [refresh]);

  const wipeAll = useCallback(async () => {
    localStorage.removeItem(DEMO_KEY);
    try {
      if (!DEMO_MODE_ENV) await ApiService.deleteAccount();
    } finally {
      ApiService.clearLocalData();
      demoRef.current = false;
      setDemo(false);
      setStateRaw(emptyState());
    }
  }, []);

  const suggestedName = authName && !authName.includes('@') ? authName : '';
  const value = useMemo<CareerContextValue>(() => ({
    state, suggestedName, loading, backend, demo, refresh, saveProfile, uploadResume, runAssessment, generateImprovements,
    generateRoadmap, setStageComplete, savePreferences, startDemo, exitDemo, wipeAll,
  }), [state, suggestedName, loading, backend, demo, refresh, saveProfile, uploadResume, runAssessment, generateImprovements,
    generateRoadmap, setStageComplete, savePreferences, startDemo, exitDemo, wipeAll]);

  return <CareerContext.Provider value={value}>{children}</CareerContext.Provider>;
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) throw new Error('useCareer must be used inside <CareerProvider>');
  return ctx;
}
