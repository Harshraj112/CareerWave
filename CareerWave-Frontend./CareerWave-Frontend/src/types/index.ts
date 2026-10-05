export interface UserSession {
  id: string;
  name?: string;
  email?: string;
  created_at: string;
  last_active_at: string;
}

export interface ResumeSchema {
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  skills: string[];
  experience: {
    title: string;
    company: string;
    bullets: string[];
    duration_months: number;
  }[];
  education: {
    degree: string;
    institution: string;
    year?: string;
  }[];
  ats_issues: string[];
  raw_text?: string;
}

export interface SkillWeight {
  skill: string;
  weight: number;
  required: boolean;
  category?: string;
}

export interface RoleProfile {
  id: string;
  role_title: string;
  category: string;
  required_skills: SkillWeight[];
  source: 'seeded_aggregate' | 'llm_generated';
  generated_at?: string;
}

export interface GapItem {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  present: boolean;
  category?: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  resume_id?: string | null;
  target_role_id?: string | null;
  target_role_title?: string;
  target_jd_text?: string | null;
  match_score: number; // 0-100
  score_breakdown: {
    keyword_match: number;
    seniority_match: number;
    required_skills_hit: number;
  };
  gap_list: GapItem[];
  created_at: string;
}

export interface LearningResource {
  skill: string;
  type: 'book' | 'course' | 'doc';
  title: string;
  url: string;
  est_hours: number;
  description?: string;
}

export interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  required_skills: string[];
  fit_score: number;
  raw_description: string;
  apply_url: string;
  tailored_resume_snapshot?: {
    summary_tweak: string;
    highlighted_skills: string[];
    suggested_bullets: string[];
  };
}

export interface ManualProfile {
  education?: {
    degree: string;
    institution: string;
    graduation_year: string;
  };
  current_skills: string[];
  experience_level: string; // Entry, Mid, Senior
  job_field: string;
  custom_jd?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Career Wave v2 — onboarding, AI analysis, roadmap, jobs, notifications.
// These mirror the backend contracts (backend/src/ai/normalize.js, store.js).
// The types above are kept for the legacy ApiService methods.
// ════════════════════════════════════════════════════════════════════════════

export type UserPath = 'resume' | 'beginner';
export type Priority = 'high' | 'medium' | 'low';
/** Where a result came from. Anything other than 'ai' is labelled in the UI. */
export type AnalysisSource = 'ai' | 'mock' | 'demo';

export interface EducationInfo {
  degree: string | null;
  institution: string | null;
  graduationYear: string | null;
}

/** Collected right after sign-in; the target role follows the user everywhere. */
export interface OnboardingProfile {
  name: string;
  email: string | null;
  targetRole: string;
  path: UserPath | null;
  experienceLevel: string | null;
  currentSkills: string[];
  education: EducationInfo | null;
  background: string | null;
  onboardingComplete: boolean;
  updatedAt: string | null;
}

export interface TargetRoleOption {
  title: string;
  description: string;
}

// ── Parsed resume (Resume Parser output, schema.json → resume_data) ──────────

export interface ParsedWorkExperience {
  company: string | null;
  title: string | null;
  location?: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current?: boolean;
  employment_type?: string | null;
  description: string[];
  skills_used?: string[];
}

export interface ParsedEducation {
  institution: string | null;
  degree: string | null;
  field_of_study?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  gpa?: string | null;
  honors?: string[];
}

export interface ParsedResumeData {
  parsing_meta?: { is_resume?: boolean; warnings?: string[] };
  personal_info?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    other_links?: string[];
  };
  summary?: string | null;
  total_experience_years?: number | null;
  work_experience?: ParsedWorkExperience[];
  education?: ParsedEducation[];
  skills?: { technical?: string[]; tools?: string[]; soft?: string[]; languages_spoken?: string[] };
  certifications?: { name: string | null; issuer: string | null; date_obtained?: string | null; expiry_date?: string | null; credential_id?: string | null }[];
  projects?: { name: string | null; description: string | null; tech_stack?: string[]; url?: string | null; date?: string | null }[];
  publications?: { title: string | null; publisher: string | null; date?: string | null; url?: string | null }[];
  awards?: { title: string | null; issuer?: string | null; date?: string | null; description?: string | null }[];
  volunteer_experience?: { organization: string | null; role: string | null; start_date?: string | null; end_date?: string | null; description?: string | null }[];
  ats_analysis?: { overall_score?: number; subscores?: { category: string; score: number; max: number; reasoning: string }[]; note?: string | null };
  gap_analysis?: { area: string; issue: string; severity: Priority }[];
  suggestions?: { area: string; suggestion: string }[];
}

export interface ResumeRecord {
  id: string;
  originalFilename: string;
  mimeType?: string;
  uploadedAt: string;
  targetRole: string | null;
  parsedData: {
    input_mode: string;
    target?: { stated_explicitly?: boolean; target_description?: string | null };
    resume_data: ParsedResumeData;
    warnings: string[];
    clarification_needed?: string[];
  };
}

// ── Score overview (AI assessment) ───────────────────────────────────────────

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  score: number;
  max: number;
  reason: string;
}

export interface ScoreOverview {
  id: string;
  createdAt: string;
  source: AnalysisSource;
  model?: string;
  targetRole: string;
  resumeId?: string | null;
  atsScore: number;
  scoreLabel: 'Strong' | 'Competitive' | 'Developing' | 'Needs work';
  interpretation: string;
  scoreBreakdown: ScoreBreakdownItem[];
  skillsMatched: { skill: string; evidence: string }[];
  skillsMissing: { skill: string; importance: Priority; reason: string }[];
  experienceAlignment: { rating: 'strong' | 'partial' | 'weak'; summary: string; relevantYears: number | null };
  resumeIssues: { issue: string; severity: Priority }[];
  strengths: string[];
  weaknesses: string[];
  experienceLevel: string | null;
}

// ── Improvement analysis ─────────────────────────────────────────────────────

export type ImprovementCategory =
  | 'structure' | 'ats' | 'skills' | 'experience' | 'projects'
  | 'education' | 'certifications' | 'keywords' | 'role_alignment' | 'evidence';

export interface ImprovementItem {
  id: string;
  category: ImprovementCategory;
  problem: string;
  explanation: string;
  impact: string;
  fix: string;
  suggestedAction: string;
  priority: Priority;
  missingEvidence: string | null;
  example: { before: string; after: string } | null;
}

export interface ImprovementAnalysis {
  id: string;
  createdAt: string;
  source: AnalysisSource;
  targetRole: string;
  summary: string;
  priorities: string[];
  items: ImprovementItem[];
}

// ── Roadmap ──────────────────────────────────────────────────────────────────

export interface RoadmapResource {
  title: string;
  type: 'course' | 'book' | 'docs' | 'video' | 'practice';
  provider: string | null;
  url: string | null;
}

export interface RoadmapStage {
  id: string;
  order: number;
  title: string;
  skills: string[];
  reason: string;
  priority: Priority;
  prerequisites: string[];
  topics: string[];
  expectedOutcome: string;
  estimatedTime: string;
  estimatedHours: number;
  projects: { title: string; description: string }[];
  resources: RoadmapResource[];
  milestone: string;
}

export interface CareerRoadmap {
  id: string;
  createdAt: string;
  source: AnalysisSource;
  mode: UserPath;
  targetRole: string;
  experienceLevel?: string | null;
  startingPoint: string;
  summary: string;
  totalEstimatedTime: string;
  stages: RoadmapStage[];
  interviewPrep: { topics: string[]; tips: string[] };
  readinessMilestones: { title: string; criteria: string }[];
  generalTips: string[];
}

export type BeginnerRoadmapInput = {
  mode: 'beginner';
  targetRole: string;
  experienceLevel: string;
  skills: string[];
  education?: EducationInfo | null;
  background?: string | null;
};
export type RoadmapRequest = { mode: 'resume' } | BeginnerRoadmapInput;

// ── Jobs & notifications ─────────────────────────────────────────────────────

export type JobType = 'full-time' | 'internship' | 'part-time' | 'contract' | 'entry-level' | 'graduate';

export interface JobSearchPreferences {
  /** null = use the onboarding target role */
  role: string | null;
  locations: string[];
  remote: boolean;
  jobTypes: JobType[];
  updatedAt: string | null;
}

export type NotificationChannel = 'whatsapp' | 'telegram';

export interface NotificationPreferences {
  enabled: boolean;
  consent: boolean;
  consentAt: string | null;
  channel: NotificationChannel | null;
  telegramChatId: string | null;
  whatsappNumber: string | null;
  frequency: 'daily' | 'weekly';
  lastSentAt: string | null;
  updatedAt: string | null;
}

export interface UserPreferences {
  jobSearch: JobSearchPreferences;
  notifications: NotificationPreferences;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  postedDate: string | null;
  source: string;
  link: string;
  tags: string[];
  description: string;
  isRemote: boolean;
  credibility: number;
  matchScore: number;
  matchReasons: string[];
}

export interface JobSearchResult {
  jobs: JobListing[];
  catalogSize: number;
  catalogUpdatedAt: string | null;
  refreshing: boolean;
  scraperAvailable: boolean;
  /** true when the list is sample data (demo mode / backend unreachable) */
  demo?: boolean;
}

export interface PublicConfig {
  telegramBotUsername: string | null;
  notificationChannels: { telegram: boolean; whatsapp: boolean };
  aiProvider: string;
  aiConfigured: boolean;
}

/** Everything that must survive a page refresh. Backend is the source of truth. */
export interface CareerState {
  profile: OnboardingProfile;
  resume: ResumeRecord | null;
  assessment: ScoreOverview | null;
  improvements: ImprovementAnalysis | null;
  roadmap: CareerRoadmap | null;
  roadmapProgress: Record<string, string>;
  preferences: UserPreferences;
  updatedAt: string | null;
}
