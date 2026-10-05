import React, { useState, useRef, useEffect } from 'react';
import type { UserSession, ResumeSchema, Assessment, LearningResource, JobMatch, ManualProfile } from '../types';
import { ApiService } from '../services/api';
import { DEMO_SAMPLE_RESUME } from '../data/mockData';
import confetti from 'canvas-confetti';
import {
  User,
  Mail,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Briefcase,
  ExternalLink,
  GraduationCap,
  Plus,
  X,
  Code,
  Layers,
  Cpu,
  Cloud,
  BarChart,
  Send,
  Clock,
  Zap,
  RotateCcw,
  Flame,
  CheckSquare,
  ShieldCheck,
  Server,
  TrendingUp,
  DollarSign,
  Building2,
  Check,
  Activity,
  Sliders,
  Award
} from 'lucide-react';

interface ProgressiveFlowProps {
  session: UserSession | null;
  onSessionCreated: (s: UserSession) => void;
  onResetAll: () => void;
  onOpenPrivacy: () => void;
}

const CAREER_TRACKS: Record<string, {
  category: string;
  salary: string;
  demandPct: number;
  timeToHire: string;
  companies: string[];
  coreSkills: string[];
  trendingAddons: string[];
}> = {
  'Frontend Developer': {
    category: 'Web & UI Engineering',
    salary: '$130k - $175k',
    demandPct: 88,
    timeToHire: '3 - 4 wks',
    companies: ['Stripe', 'Vercel', 'Airbnb', 'Linear'],
    coreSkills: ['React', 'TypeScript', 'Tailwind CSS', 'HTML5/CSS3', 'REST API & GraphQL'],
    trendingAddons: ['Next.js 15', 'Zustand', 'React Server Components', 'Playwright']
  },
  'Backend Developer': {
    category: 'Backend & Systems',
    salary: '$140k - $185k',
    demandPct: 92,
    timeToHire: '3 - 5 wks',
    companies: ['Datadog', 'Coinbase', 'Plaid', 'Supabase'],
    coreSkills: ['Python (FastAPI/Django)', 'PostgreSQL / SQL', 'RESTful API Design', 'Docker & Containerization'],
    trendingAddons: ['Redis & Caching', 'Microservices', 'Kafka', 'System Design']
  },
  'Full Stack Engineer': {
    category: 'End-to-End Product',
    salary: '$145k - $190k',
    demandPct: 95,
    timeToHire: '3 - 4 wks',
    companies: ['GitHub', 'Shopify', 'Brex', 'Retool'],
    coreSkills: ['React / Next.js', 'Node.js / Python', 'TypeScript', 'PostgreSQL & ORM', 'Docker'],
    trendingAddons: ['Prisma', 'Tailwind', 'CI/CD Pipelines', 'AWS Deployment']
  },
  'AI / Machine Learning Engineer': {
    category: 'Artificial Intelligence',
    salary: '$165k - $225k',
    demandPct: 98,
    timeToHire: '2 - 4 wks',
    companies: ['Anthropic', 'OpenAI', 'Scale AI', 'Hugging Face'],
    coreSkills: ['Python', 'PyTorch or TensorFlow', 'LLMs & Prompt Engineering', 'Vector Databases'],
    trendingAddons: ['LangChain / LlamaIndex', 'Fine-tuning', 'RAG Architecture', 'FastAPI']
  },
  'DevOps & Cloud Engineer': {
    category: 'Cloud & Infrastructure',
    salary: '$145k - $195k',
    demandPct: 90,
    timeToHire: '4 - 6 wks',
    companies: ['AWS', 'HashiCorp', 'GitLab', 'Cloudflare'],
    coreSkills: ['Linux & Shell Scripting', 'Docker & Kubernetes', 'AWS / Cloud', 'CI/CD Pipelines'],
    trendingAddons: ['Terraform', 'Prometheus', 'ArgoCD', 'Observability']
  },
  'Data Analyst & Scientist': {
    category: 'Analytics & Science',
    salary: '$125k - $165k',
    demandPct: 86,
    timeToHire: '3 - 5 wks',
    companies: ['Snowflake', 'Palantir', 'Spotify', 'dbt Labs'],
    coreSkills: ['SQL & Data Warehousing', 'Python (Pandas, NumPy)', 'Statistical Modeling', 'Tableau / PowerBI'],
    trendingAddons: ['dbt', 'A/B Testing', 'DuckDB', 'Scikit-Learn']
  }
};

export const ProgressiveFlow: React.FC<ProgressiveFlowProps> = ({
  session,
  onSessionCreated,
  onResetAll,
  onOpenPrivacy
}) => {
  // Step 1: Resume choice
  const [resumeChoice, setResumeChoice] = useState<'upload' | 'manual' | null>(null);

  // Active track chosen
  const [activeRoleTitle, setActiveRoleTitle] = useState('Frontend Developer');

  // Step 3A: Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parseStatus, setParseStatus] = useState('');
  const [parsedData, setParsedData] = useState<ResumeSchema | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [customJdText, setCustomJdText] = useState('');
  const [useCustomJd, setUseCustomJd] = useState(false);
  const [targetSubmitting, setTargetSubmitting] = useState(false);

  // Step 3B: Manual details state (All optional)
  const [degree, setDegree] = useState('');
  const [institution, setInstitution] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [expTier, setExpTier] = useState('Entry-level (0-2 years)');
  const [manualSkills, setManualSkills] = useState<string[]>([]);
  const [manualSkillInput, setManualSkillInput] = useState('');
  const [customFieldText, setCustomFieldText] = useState('');
  const [isCustomField, setIsCustomField] = useState(false);
  const [manualJdText, setManualJdText] = useState('');

  // Step 4: Assessment state
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [learningPath, setLearningPath] = useState<LearningResource[]>([]);
  const [jobMatches, setJobMatches] = useState<JobMatch[]>([]);
  const [gapFilter, setGapFilter] = useState<'all' | 'missing' | 'matched'>('all');
  const [selectedJobModal, setSelectedJobModal] = useState<JobMatch | null>(null);
  const [notifSending, setNotifSending] = useState(false);
  const [notifSent, setNotifSent] = useState(false);
  const [showArchModal, setShowArchModal] = useState(false);

  // ATS Checklist state for radar
  const [atsChecklist, setAtsChecklist] = useState<Record<string, boolean>>({
    'single_col': true,
    'clean_headers': true,
    'quant_metrics': true,
    'standard_fonts': true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const line3Ref = useRef<HTMLDivElement>(null);
  const line4Ref = useRef<HTMLDivElement>(null);

  // Current active career track metadata
  const currentTrack = CAREER_TRACKS[activeRoleTitle] || CAREER_TRACKS['Frontend Developer'];

  // All currently captured skills
  const allCurrentSkills = parsedData?.skills || manualSkills;

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  // STEP 1: Resume choice
  const handleChooseResume = (choice: 'upload' | 'manual') => {
    setResumeChoice(choice);
    scrollTo(line3Ref);
  };

  // STEP 3A: File upload
  const handleFile = async (f: File, isDemo = false) => {
    setUploadedFile(f);
    setParsing(true);
    try {
      setParseStatus('Reading document text...');
      await new Promise(r => setTimeout(r, 400));
      setParseStatus('Extracting skills & experience with LLM...');
      await new Promise(r => setTimeout(r, 500));
      setParseStatus('Checking ATS readability rules...');
      const res = await ApiService.uploadResume(f, isDemo);
      setResumeId(res.id);
      setParsedData(res.parsed_json);
    } catch (e) {
      console.error(e);
    } finally {
      setParsing(false);
      setParseStatus('');
    }
  };

  const loadDemoResume = () => {
    const demoBlob = new Blob([DEMO_SAMPLE_RESUME.raw_text || ''], { type: 'text/plain' });
    const demoFile = new File([demoBlob], 'Alex_Rivera_Resume.pdf', { type: 'application/pdf' });
    handleFile(demoFile, true);
  };

  const addParsedSkill = () => {
    if (!newSkill.trim() || !parsedData) return;
    if (!parsedData.skills.includes(newSkill.trim())) {
      setParsedData({ ...parsedData, skills: [...parsedData.skills, newSkill.trim()] });
    }
    setNewSkill('');
  };

  const removeParsedSkill = (skill: string) => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, skills: parsedData.skills.filter(s => s !== skill) });
  };

  const handleAssessPathA = async () => {
    if (!session || !resumeId) return;
    setTargetSubmitting(true);
    try {
      const asm = await ApiService.createAssessment({
        user_id: session.id,
        resume_id: resumeId,
        target_role_title: useCustomJd ? undefined : activeRoleTitle,
        custom_jd_text: useCustomJd ? customJdText : undefined
      });
      setAssessment(asm);
      await loadExtras(asm);
      scrollTo(line4Ref);
    } catch (e) {
      console.error(e);
    } finally {
      setTargetSubmitting(false);
    }
  };

  // STEP 3B: Manual details
  const addManualSkill = (skill: string) => {
    const s = skill.trim();
    if (!s) return;
    if (!manualSkills.includes(s)) {
      setManualSkills([...manualSkills, s]);
    }
    setManualSkillInput('');
  };

  const removeManualSkill = (skill: string) => {
    setManualSkills(manualSkills.filter(s => s !== skill));
  };

  const handleAssessPathB = async () => {
    if (!session) return;
    setTargetSubmitting(true);
    try {
      const finalRole = isCustomField ? (customFieldText.trim() || 'Software Engineer') : activeRoleTitle;
      const manualProfile: ManualProfile = {
        education: degree || institution ? { degree, institution, graduation_year: gradYear } : undefined,
        current_skills: manualSkills,
        experience_level: expTier,
        job_field: finalRole,
        custom_jd: manualJdText.trim() || undefined
      };

      const asm = await ApiService.createAssessment({
        user_id: session.id,
        resume_id: null,
        target_role_title: finalRole,
        custom_jd_text: manualJdText.trim() || undefined,
        manual_profile: manualProfile
      });
      setAssessment(asm);
      await loadExtras(asm);
      scrollTo(line4Ref);
    } catch (e) {
      console.error(e);
    } finally {
      setTargetSubmitting(false);
    }
  };

  const loadExtras = async (asm: Assessment, opts?: { skipCelebration?: boolean }) => {
    try {
      const [resources, jobs] = await Promise.all([
        ApiService.getLearningPath(asm.gap_list),
        ApiService.getJobMatches(session?.id || 'demo_user', asm.gap_list.filter(g => g.present).map(g => g.skill))
      ]);
      setLearningPath(resources);
      setJobMatches(jobs);
      if (!opts?.skipCelebration && asm.match_score >= 70) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Rehydrate on mount: api.ts already persists the resume & assessment to
  // localStorage, but component state started empty on every refresh. Restore
  // whatever progress exists so a reload doesn't send the user back to Step 1. ──
  useEffect(() => {
    const storedResume = ApiService.getCurrentResume();
    const storedAssessment = ApiService.getCurrentAssessment();

    if (storedResume) {
      setResumeChoice('upload');
      setResumeId(storedResume.id);
      setParsedData(storedResume.parsed_json);
    } else if (storedAssessment && !storedAssessment.resume_id) {
      // Assessment exists with no resume attached → it came from the manual path.
      setResumeChoice('manual');
    }

    if (storedAssessment) {
      setAssessment(storedAssessment);
      if (storedAssessment.target_role_title) {
        setActiveRoleTitle(storedAssessment.target_role_title);
      }
      loadExtras(storedAssessment, { skipCelebration: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Let the user change their resume choice without a full account reset ──
  const handleChangeResumeChoice = () => {
    setResumeChoice(null);
    setUploadedFile(null);
    setParsedData(null);
    setResumeId(null);
    setDegree('');
    setInstitution('');
    setGradYear('');
    setManualSkills([]);
    setIsCustomField(false);
    setCustomFieldText('');
    setManualJdText('');
    setAssessment(null);
    setLearningPath([]);
    setJobMatches([]);
    localStorage.removeItem('rp_current_resume');
    localStorage.removeItem('rp_current_assessment');
    scrollTo(line2Ref);
  };

  const handleSendDigest = async () => {
    if (!session) return;
    setNotifSending(true);
    try {
      await ApiService.sendDigest(session.id, session.email || 'demo@user.dev');
      setNotifSent(true);
      setTimeout(() => setNotifSent(false), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setNotifSending(false);
    }
  };

  return (
    <div className="w-full py-8">
      {/* Single focused column while onboarding; expands into the full studio
          dashboard (with sidebar) only once an assessment exists. */}
      <div className={assessment ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-start' : 'flex justify-center'}>

        {/* ========================================================================= */}
        {/* LEFT COLUMN: onboarding wizard steps, then assessment results             */}
        {/* ========================================================================= */}
        <div className={assessment ? 'lg:col-span-7 space-y-8' : 'w-full max-w-2xl space-y-8'}>

          {/* Greeting banner — replaces the login step since user is already signed in */}
          <div className="flex items-center space-x-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center text-lg font-black flex-shrink-0">
              {session?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-base font-extrabold text-stone-900">
                  Hey, {session?.name?.split(' ')[0] ?? 'there'} 👋
                </h1>
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Session Active</span>
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 truncate">
                {session?.email} &nbsp;•&nbsp; <span className="font-mono">{session?.id?.substring(0, 12)}…</span>
              </p>
            </div>
            <div className="hidden sm:flex items-center space-x-2 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-stone-600">Let's build your roadmap</span>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 1 (in flow): Resume Choice — always visible (user already logged in) */}
          {/* ----------------------------------------------------------------------- */}
          <div ref={line2Ref} id="feature-resume-choice" className="scroll-mt-24">
            <section className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      resumeChoice ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-900 text-white'
                    }`}>
                      {resumeChoice ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : '2'}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-stone-900">
                        Do you have a resume you'd like to upload?
                      </h2>
                      <p className="text-[11px] text-stone-500">
                        Step 2: Choose whether to parse a file or answer basic questions.
                      </p>
                    </div>
                  </div>

                  {resumeChoice && (
                    <button
                      type="button"
                      onClick={handleChangeResumeChoice}
                      className="flex-shrink-0 text-xs font-semibold text-stone-500 hover:text-stone-900 underline"
                    >
                      Change answer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Option A: Yes */}
                  <div
                    onClick={() => handleChooseResume('upload')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      resumeChoice === 'upload'
                        ? 'border-stone-900 bg-stone-50 shadow-xs ring-1 ring-stone-900'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                    }`}
                  >
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-2.5">
                        <FileText className="w-4 h-4 text-stone-900" />
                      </div>
                      <div className="font-bold text-xs text-stone-900 mb-1">
                        Yes, upload my resume
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Upload your PDF, DOCX, or text file. We'll automatically parse your skills, check ATS readability, and match roles.
                      </p>
                    </div>
                    <div className="mt-3.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] font-semibold text-stone-900">
                      <span>Upload & extract</span>
                      <span>→</span>
                    </div>
                  </div>

                  {/* Option B: No */}
                  <div
                    onClick={() => handleChooseResume('manual')}
                    className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      resumeChoice === 'manual'
                        ? 'border-stone-900 bg-stone-50 shadow-xs ring-1 ring-stone-900'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                    }`}
                  >
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-2.5">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="font-bold text-xs text-stone-900 mb-1">
                        No, let's start fresh
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        No resume required. Enter basic optional details and pick your target field of job to see required skills.
                      </p>
                    </div>
                    <div className="mt-3.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] font-semibold text-stone-900">
                      <span>Enter details manually</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 3: Branch based on choice                                          */}
          {/* ----------------------------------------------------------------------- */}
          {resumeChoice && (
            <div ref={line3Ref} className="scroll-mt-24">
              <section className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
                
                {/* BRANCH A: Upload Resume flow */}
                {resumeChoice === 'upload' && (
                  <div className="space-y-5">
                    <div className="flex items-center space-x-3 pb-3 border-b border-stone-100">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        parsedData ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-900 text-white'
                      }`}>
                        {parsedData ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : '3'}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-stone-900">
                          Upload & Review Your Resume
                        </h2>
                        <p className="text-[11px] text-stone-500">
                          Step 3: Extract competencies and verify ATS formatting.
                        </p>
                      </div>
                    </div>

                    {!parsedData ? (
                      <div className="space-y-3">
                        {parsing ? (
                          <div className="py-12 border border-stone-200 rounded-xl bg-stone-50 text-center space-y-3">
                            <div className="w-8 h-8 rounded-full border-2 border-stone-900 border-t-transparent animate-spin mx-auto" />
                            <p className="text-xs font-medium text-stone-800">{parseStatus}</p>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                            }}
                            className="border-2 border-dashed border-stone-300 hover:border-stone-500 rounded-xl p-8 sm:p-10 text-center cursor-pointer bg-stone-50/50 hover:bg-stone-50 transition"
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf,.docx,.txt"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleFile(e.target.files[0]);
                              }}
                            />
                            <UploadCloud className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                            <div className="text-xs sm:text-sm font-bold text-stone-900">
                              Drop your resume file here, or <span className="underline">browse</span>
                            </div>
                            <p className="text-[11px] text-stone-500 mt-1">
                              Supports PDF, Word (DOCX), or TXT • Max 10MB
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                          <span>Don't have a file ready?</span>
                          <button
                            type="button"
                            onClick={loadDemoResume}
                            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-800 underline hover:text-stone-950"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span>Load sample resume (Alex Rivera)</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-4 h-4 text-stone-700" />
                            <div>
                              <div className="font-bold text-stone-900">{parsedData.contact.name || uploadedFile?.name}</div>
                              <div className="text-[11px] text-stone-500">{parsedData.contact.email}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setParsedData(null); setUploadedFile(null); }}
                            className="text-xs text-stone-500 hover:text-stone-900 underline"
                          >
                            Change file
                          </button>
                        </div>

                        {parsedData.ats_issues && parsedData.ats_issues.length > 0 && (
                          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-1">
                            <div className="font-semibold flex items-center space-x-1.5 text-amber-800">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span>ATS Readability Warnings</span>
                            </div>
                            <ul className="list-disc list-inside text-stone-700 pl-1 space-y-0.5 text-[11px]">
                              {parsedData.ats_issues.map((iss, i) => (
                                <li key={i}>{iss}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Extracted skills tags */}
                        <div>
                          <label className="block text-xs font-bold text-stone-800 mb-2">
                            Extracted skills ({parsedData.skills.length})
                          </label>
                          <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {parsedData.skills.map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200"
                              >
                                <span>{s}</span>
                                <button
                                  onClick={() => removeParsedSkill(s)}
                                  className="text-stone-400 hover:text-red-600 ml-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center space-x-2 max-w-xs">
                            <input
                              type="text"
                              value={newSkill}
                              onChange={(e) => setNewSkill(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParsedSkill())}
                              placeholder="Add another skill..."
                              className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                            />
                            <button
                              type="button"
                              onClick={addParsedSkill}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs border border-stone-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Target role selector */}
                        <div id="feature-role-profile" className="pt-3 border-t border-stone-100 space-y-2.5">
                          <label className="block text-xs font-bold text-stone-800">
                            Which target role would you like to evaluate against?
                          </label>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.keys(CAREER_TRACKS).map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => { setActiveRoleTitle(role); setUseCustomJd(false); }}
                                className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition ${
                                  !useCustomJd && activeRoleTitle === role
                                    ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setUseCustomJd(!useCustomJd)}
                              className="text-xs text-stone-600 hover:text-stone-900 underline font-medium"
                            >
                              {useCustomJd ? '← Select from standard tracks' : '+ Or paste a specific job description (JD)'}
                            </button>

                            {useCustomJd && (
                              <textarea
                                rows={3}
                                value={customJdText}
                                onChange={(e) => setCustomJdText(e.target.value)}
                                placeholder="Paste job requirements here..."
                                className="mt-2 w-full p-2.5 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                              />
                            )}
                          </div>
                        </div>

                        {/* Submit button */}
                        <div className="pt-3 border-t border-stone-100 flex justify-end">
                          <button
                            type="button"
                            onClick={handleAssessPathA}
                            disabled={targetSubmitting}
                            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 shadow-xs transition disabled:opacity-50"
                          >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>{targetSubmitting ? 'Evaluating skills...' : 'Check My Readiness & Match Roles'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BRANCH B: Manual Details & Job Field flow (Requirements 4 & 5) */}
                {resumeChoice === 'manual' && (
                  <div className="space-y-6">
                    
                    {/* Line 3B Part 1: Basic details (Optional) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center text-xs font-semibold">
                            3a
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-stone-900">
                              A few basic details
                            </h2>
                            <p className="text-[11px] text-stone-500">
                              Requirement 4: Education & details are strictly optional.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                          Optional
                        </span>
                      </div>

                      {/* Education Background */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-stone-700 flex items-center space-x-1.5">
                          <GraduationCap className="w-4 h-4 text-stone-500" />
                          <span>Education Background (Optional)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <input
                            type="text"
                            value={degree}
                            onChange={(e) => setDegree(e.target.value)}
                            placeholder="Degree (e.g. B.S. CS, Bootcamp)"
                            className="px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                          />
                          <input
                            type="text"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            placeholder="College / School"
                            className="px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                          />
                          <input
                            type="text"
                            value={gradYear}
                            onChange={(e) => setGradYear(e.target.value)}
                            placeholder="Graduation Year"
                            className="px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                          />
                        </div>
                      </div>

                      {/* Experience Tier */}
                      <div className="space-y-2 pt-1">
                        <div className="text-xs font-semibold text-stone-700">
                          Experience Tier
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            'Beginner / Student',
                            'Entry-level (0-2 yrs)',
                            'Mid-level (3-5 yrs)',
                            'Senior (5+ yrs)'
                          ].map((tier) => (
                            <button
                              key={tier}
                              type="button"
                              onClick={() => setExpTier(tier)}
                              className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition ${
                                expTier === tier
                                  ? 'border-stone-900 bg-stone-900 text-white'
                                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Existing Skills */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-semibold text-stone-700">
                          Technologies you already know (Optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {manualSkills.map((sk) => (
                            <span
                              key={sk}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200"
                            >
                              <span>{sk}</span>
                              <button
                                type="button"
                                onClick={() => removeManualSkill(sk)}
                                className="text-stone-400 hover:text-red-600 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center space-x-2 max-w-xs">
                          <input
                            type="text"
                            value={manualSkillInput}
                            onChange={(e) => setManualSkillInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addManualSkill(manualSkillInput))}
                            placeholder="Type skill & enter..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                          />
                          <button
                            type="button"
                            onClick={() => addManualSkill(manualSkillInput)}
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs border border-stone-200"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Line 3B Part 2: Field of job (Requirement 5) */}
                    <div id="feature-role-profile" className="pt-5 border-t border-stone-200 space-y-3.5">
                      <div className="flex items-center space-x-3 pb-1">
                        <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-800 flex items-center justify-center text-xs font-semibold">
                          3b
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-stone-900">
                            Which field of job are you looking for?
                          </h2>
                          <p className="text-[11px] text-stone-500">
                            Requirement 5: Select your target track to see needed skills.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {[
                          { title: 'Frontend Developer', icon: Code, desc: 'React, Next.js, UI engineering' },
                          { title: 'Backend Developer', icon: Layers, desc: 'Python, FastAPI, SQL, Architecture' },
                          { title: 'Full Stack Engineer', icon: Briefcase, desc: 'End-to-end web products' },
                          { title: 'AI / Machine Learning Engineer', icon: Cpu, desc: 'LLMs, PyTorch, GenAI' },
                          { title: 'DevOps & Cloud Engineer', icon: Cloud, desc: 'Docker, AWS, CI/CD' },
                          { title: 'Data Analyst & Scientist', icon: BarChart, desc: 'SQL, Analytics, Visualization' },
                        ].map((field) => {
                          const Icon = field.icon;
                          const isSelected = !isCustomField && activeRoleTitle === field.title;
                          return (
                            <div
                              key={field.title}
                              onClick={() => { setActiveRoleTitle(field.title); setIsCustomField(false); }}
                              className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                isSelected
                                  ? 'border-stone-900 bg-stone-50 shadow-xs ring-1 ring-stone-900'
                                  : 'border-stone-200 bg-white hover:border-stone-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-stone-900" />}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-stone-900">{field.title}</div>
                                <div className="text-[10px] text-stone-500 mt-0.5">{field.desc}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Custom field toggle */}
                      <div className="pt-1">
                        <label className="inline-flex items-center space-x-2 text-xs font-semibold text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCustomField}
                            onChange={(e) => setIsCustomField(e.target.checked)}
                            className="rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                          />
                          <span>Looking for a custom role or specific JD?</span>
                        </label>

                        {isCustomField && (
                          <div className="mt-2 space-y-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                            <input
                              type="text"
                              value={customFieldText}
                              onChange={(e) => setCustomFieldText(e.target.value)}
                              placeholder="e.g. Mobile Developer, Security Engineer"
                              className="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                            />
                            <textarea
                              rows={2}
                              value={manualJdText}
                              onChange={(e) => setManualJdText(e.target.value)}
                              placeholder="Optional: Paste job requirements..."
                              className="w-full p-2 rounded-lg border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-stone-400"
                            />
                          </div>
                        )}
                      </div>

                      {/* Submit */}
                      <div className="pt-3 border-t border-stone-100 flex justify-end">
                        <button
                          type="button"
                          onClick={handleAssessPathB}
                          disabled={targetSubmitting}
                          className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 shadow-xs transition disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>{targetSubmitting ? 'Generating roadmap...' : 'Explore Required Skills & My Roadmap'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* STEP 4: Assessment Results, Skill Gaps & Roadmap (Convergence)          */}
          {/* ----------------------------------------------------------------------- */}
          {assessment && (
            <div ref={line4Ref} className="scroll-mt-24">
              <section className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-0.5">
                      Your Career Roadmap
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                      Target: {assessment.target_role_title}
                    </h2>
                    <p className="text-xs text-stone-500">
                      {assessment.resume_id ? 'Evaluated from uploaded resume' : 'Evaluated from role profile'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2" id="feature-notifications">
                    <button
                      type="button"
                      onClick={handleSendDigest}
                      disabled={notifSending}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        notifSent
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{notifSending ? 'Sending...' : notifSent ? 'Digest Sent! ✓' : 'Send Alert Demo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onResetAll}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-stone-200 hover:border-stone-300 text-stone-600 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Score Ring & Breakdown */}
                <div id="feature-scoring" className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center bg-stone-50 p-5 rounded-2xl border border-stone-100">
                  <div className="sm:col-span-4 flex flex-col items-center justify-center text-center">
                    <div className="relative w-24 h-24 flex items-center justify-center mb-1">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="38" stroke="#e7e5e4" strokeWidth="7" fill="transparent" />
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke="#1c1917"
                          strokeWidth="7"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 38}
                          strokeDashoffset={2 * Math.PI * 38 * (1 - assessment.match_score / 100)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-extrabold text-stone-900">{assessment.match_score}%</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-stone-900">Overall Readiness</div>
                  </div>

                  <div className="sm:col-span-8 space-y-2.5">
                    <div className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                      Explainable Formula Breakdown
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                        <div className="text-[10px] text-stone-500">Core (70%)</div>
                        <div className="text-base font-bold text-stone-900">{assessment.score_breakdown.required_skills_hit}%</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                        <div className="text-[10px] text-stone-500">Keywords (20%)</div>
                        <div className="text-base font-bold text-stone-900">{assessment.score_breakdown.keyword_match}%</div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                        <div className="text-[10px] text-stone-500">Seniority (10%)</div>
                        <div className="text-base font-bold text-stone-900">{assessment.score_breakdown.seniority_match}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skill Requirements Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        Required Skills Checklist
                      </h3>
                      <p className="text-[11px] text-stone-500">What you have vs what to learn</p>
                    </div>

                    <div className="flex items-center space-x-1 bg-stone-100 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setGapFilter('all')}
                        className={`px-2 py-0.5 rounded-md transition ${gapFilter === 'all' ? 'bg-white shadow-xs font-semibold text-stone-900' : 'text-stone-600'}`}
                      >
                        All ({assessment.gap_list.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGapFilter('missing')}
                        className={`px-2 py-0.5 rounded-md transition ${gapFilter === 'missing' ? 'bg-white shadow-xs font-semibold text-amber-800' : 'text-stone-600'}`}
                      >
                        Missing ({assessment.gap_list.filter(g => !g.present).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGapFilter('matched')}
                        className={`px-2 py-0.5 rounded-md transition ${gapFilter === 'matched' ? 'bg-white shadow-xs font-semibold text-emerald-800' : 'text-stone-600'}`}
                      >
                        Matched ({assessment.gap_list.filter(g => g.present).length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {assessment.gap_list
                      .filter(item => {
                        if (gapFilter === 'missing') return !item.present;
                        if (gapFilter === 'matched') return item.present;
                        return true;
                      })
                      .map((gap, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            gap.present
                              ? 'border-stone-200 bg-stone-50/50 text-stone-800'
                              : 'border-amber-200/80 bg-amber-50/40 text-stone-900'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {gap.present ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-semibold text-stone-900">{gap.skill}</div>
                              <div className="text-[10px] text-stone-500">{gap.category || 'Skill'}</div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                            gap.present
                              ? 'bg-emerald-100 text-emerald-800'
                              : gap.priority === 'high'
                              ? 'bg-amber-100 text-amber-900 font-semibold'
                              : 'bg-stone-200/60 text-stone-700'
                          }`}>
                            {gap.present ? 'Ready' : `${gap.priority} priority`}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Curated Learning Resources */}
                <div id="feature-learning-path" className="space-y-3 pt-4 border-t border-stone-100">
                  <div>
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Curated Learning Recommendations
                    </h3>
                    <p className="text-[11px] text-stone-500">Real books, official documentation, and courses</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {learningPath.map((res, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1.5">
                            <span className="uppercase font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                              {res.type}
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>~{res.est_hours} hrs</span>
                            </span>
                          </div>

                          <div className="text-xs font-bold text-stone-900 mb-1 leading-snug">
                            {res.title}
                          </div>

                          {res.description && (
                            <p className="text-[11px] text-stone-600 line-clamp-2 mb-2">
                              {res.description}
                            </p>
                          )}
                        </div>

                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-semibold text-stone-800 hover:text-stone-950 underline mt-1"
                        >
                          <span>Open Resource</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matching Job Listings */}
                <div id="feature-job-matcher" className="space-y-3 pt-4 border-t border-stone-100">
                  <div>
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Matching Job Openings
                    </h3>
                    <p className="text-[11px] text-stone-500">Ranked by alignment with your verified skills</p>
                  </div>

                  <div className="space-y-2.5">
                    {jobMatches.map((job) => (
                      <div
                        key={job.id}
                        className="p-3.5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-stone-900">{job.title}</h4>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                              {job.fit_score}% Fit
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-600">
                            <strong>{job.company}</strong> • {job.location} • {job.salary_range}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {job.tailored_resume_snapshot && (
                            <button
                              type="button"
                              onClick={() => setSelectedJobModal(job)}
                              className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition"
                            >
                              Tailored Bullets
                            </button>
                          )}
                          <a
                            href={job.apply_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center space-x-1"
                          >
                            <span>Apply</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (5 COLS): IT Job Market Dashboard & Live News               */}
        {/* Only revealed once an assessment exists, so onboarding stays focused.    */}
        {/* ========================================================================= */}
        {assessment && (
        <div className="lg:col-span-5 sticky top-24 space-y-5">

          {/* ── 1. Live Market Pulse for selected role ── */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Market Pulse</h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                ● Live
              </span>
            </div>

            {/* Role selector pills */}
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CAREER_TRACKS).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveRoleTitle(t)}
                  className={`py-1 px-2.5 rounded-full text-[11px] font-semibold transition ${
                    activeRoleTitle === t
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="flex items-center space-x-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Salary</span>
                </div>
                <div className="text-sm font-extrabold text-stone-900">{currentTrack.salary}</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Avg. market rate (US)</div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center space-x-1.5 mb-1">
                  <Flame className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Demand</span>
                </div>
                <div className="text-sm font-extrabold text-stone-900">{currentTrack.demandPct}%</div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 mt-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${currentTrack.demandPct}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <div className="flex items-center space-x-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Time to Hire</span>
                </div>
                <div className="text-sm font-extrabold text-stone-900">{currentTrack.timeToHire}</div>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
                <div className="flex items-center space-x-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-stone-500" />
                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Hiring Now</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {currentTrack.companies.slice(0, 3).map(c => (
                    <span key={c} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-700">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. IT Job News Feed ── */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Tech Job Headlines</h3>
            </div>

            <div className="space-y-3">
              {[
                {
                  tag: 'AI / ML',
                  tagColor: 'bg-purple-100 text-purple-800',
                  headline: 'AI engineering roles surge 340% YoY — prompt engineers now in top 10 fastest-growing jobs',
                  time: '2h ago',
                  source: 'LinkedIn Economic Graph'
                },
                {
                  tag: 'Hiring',
                  tagColor: 'bg-blue-100 text-blue-800',
                  headline: 'Big Tech resumes hiring: Google, Meta, and Amazon post 50k+ openings in Q3 2025',
                  time: '5h ago',
                  source: 'TechCrunch'
                },
                {
                  tag: 'Skills',
                  tagColor: 'bg-amber-100 text-amber-800',
                  headline: 'TypeScript overtakes JavaScript as most-demanded language on job boards for the first time',
                  time: '1d ago',
                  source: 'Stack Overflow'
                },
                {
                  tag: 'Salary',
                  tagColor: 'bg-emerald-100 text-emerald-800',
                  headline: 'Full-stack engineers with cloud + AI skills command 38% salary premium in 2025 market',
                  time: '2d ago',
                  source: 'Levels.fyi'
                },
                {
                  tag: 'Remote',
                  tagColor: 'bg-stone-100 text-stone-700',
                  headline: '72% of new tech job postings now offer remote or hybrid options globally — up from 48%',
                  time: '3d ago',
                  source: 'Glassdoor'
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-3 pb-3 border-b border-stone-100 last:border-0 last:pb-0">
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.tagColor}`}>
                      {item.tag}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-stone-800 leading-snug">{item.headline}</p>
                    <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-stone-400">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. Trending Skills This Week ── */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart className="w-4 h-4 text-stone-700" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Trending Skills</h3>
              </div>
              <span className="text-[10px] text-stone-400">This week</span>
            </div>

            <div className="space-y-2">
              {[
                { skill: 'RAG / LLM Pipelines', change: '+42%', bar: 92, color: 'bg-purple-500' },
                { skill: 'TypeScript', change: '+28%', bar: 86, color: 'bg-blue-500' },
                { skill: 'Next.js 14/15', change: '+24%', bar: 80, color: 'bg-stone-800' },
                { skill: 'Kubernetes', change: '+19%', bar: 73, color: 'bg-emerald-500' },
                { skill: 'Rust', change: '+15%', bar: 61, color: 'bg-amber-500' },
                { skill: 'Terraform', change: '+12%', bar: 54, color: 'bg-teal-500' },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-stone-800">{item.skill}</span>
                    <span className="font-bold text-emerald-700">{item.change}</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5">
                    <div
                      className={`${item.color} h-1.5 rounded-full transition-all duration-700`}
                      style={{ width: `${item.bar}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4. Quick ATS Health Checklist (interactive) ── */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-stone-700" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">ATS Readiness Check</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {Object.values(atsChecklist).filter(Boolean).length * 25}% Score
              </span>
            </div>

            <div className="space-y-2">
              {[
                { id: 'single_col', label: 'Single-column layout (no ATS bleed)' },
                { id: 'clean_headers', label: 'Standard section headers used' },
                { id: 'quant_metrics', label: 'Quantifiable achievements present' },
                { id: 'standard_fonts', label: 'System fonts (Arial / Inter)' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setAtsChecklist({ ...atsChecklist, [item.id]: !atsChecklist[item.id] })}
                  className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-stone-50 cursor-pointer transition select-none"
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 transition ${
                    atsChecklist[item.id]
                      ? 'bg-stone-900 border-stone-900 text-white'
                      : 'border-stone-300 bg-white'
                  }`}>
                    {atsChecklist[item.id] && <Check className="w-3 h-3" />}
                  </div>
                  <span className={`text-[11px] font-medium ${atsChecklist[item.id] ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
        )}
      </div>

      {/* Tailored Resume Bullets Modal */}
      {selectedJobModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h4 className="text-sm font-bold text-stone-900">
                Tailored Resume Suggestions for {selectedJobModal.company}
              </h4>
              <button
                onClick={() => setSelectedJobModal(null)}
                className="text-stone-400 hover:text-stone-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-700">
              <div>
                <div className="font-semibold text-stone-900 mb-1">Targeted Summary Pitch:</div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 italic">
                  "{selectedJobModal.tailored_resume_snapshot?.summary_tweak}"
                </div>
              </div>

              <div>
                <div className="font-semibold text-stone-900 mb-1">Suggested Experience Bullets:</div>
                <ul className="list-disc list-inside space-y-1.5 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  {selectedJobModal.tailored_resume_snapshot?.suggested_bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJobModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monolith Architecture Diagram Modal */}
      {showArchModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-stone-800" />
                <h4 className="text-sm font-bold text-stone-900">
                  48-Hour Monolithic Backend Architecture
                </h4>
              </div>
              <button
                onClick={() => setShowArchModal(false)}
                className="text-stone-400 hover:text-stone-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-stone-900 text-stone-200 font-mono text-[11px] rounded-xl overflow-x-auto leading-relaxed">
{`┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Frontend    │◄────►│  API Layer        │◄────►│  Database    │
│  (Next/Vite) │      │  (FastAPI)       │      │ (Postgres)   │
└─────────────┘      └──────────────────┘      └─────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
     │ Resume Parser   │ │ Scoring/Gap  │ │ Notification  │
     │ Service         │ │ Engine       │ │ Service       │
     └────────────────┘ └──────────────┘ └──────────────┘
              │               │
              ▼               ▼
     ┌────────────────┐ ┌──────────────┐
     │ Object Storage  │ │ LLM Client    │
     │ (files)         │ │ Wrapper       │
     └────────────────┘ └──────────────┘`}
            </div>

            <div className="text-xs text-stone-600 space-y-1">
              <p><strong>Convergence Principle:</strong> Both Path A (Resume Upload) and Path B (Role Explore) hit the same unified <code>POST /assessments</code> endpoint with identical explainable scoring math.</p>
              <p><strong>Zero Ghost Retention:</strong> Resumes deleted physically vanish from storage disk.</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowArchModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
