# Career Wave — Frontend

React 19 + TypeScript + Vite + Tailwind. Auth0 for sign-in. Talks only to the Career Wave backend (`VITE_API_URL`); no AI keys or AI calls in the browser.

## Run

```bash
cp .env.example .env      # fill in Auth0 + VITE_API_URL
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check + production build
```

Local testing without Auth0: set `VITE_AUTH_DISABLED=true` here and `AUTH_DISABLED=true` (+ optionally `AI_PROVIDER=mock`) in the backend.

## User journeys

```
Sign in (Auth0) → Name + target role → "Do you already have a resume?"

I have a resume                          I'm new / no resume
  Upload (role applied automatically)      Experience level + current skills (+ optional education)
  → Resume Parser → AI assessment          → AI roadmap
  → Dashboard: ATS score overview          → Learning dashboard (progress)
  → "Want to know what to improve?"        → Jobs → Job alerts
  → Improvement analysis
  → "Want a roadmap?" → Roadmap
  → Jobs → Job alerts
```

## Code map

| Path | Role |
|---|---|
| `src/services/api.ts` | **Single integration layer** for every backend call (profile, resume, assessment, improvements, roadmap, jobs, preferences). Legacy methods kept with the same signatures. |
| `src/state/CareerContext.tsx` | The one app state store. Backend (`GET /me/state`) is authoritative; localStorage (per user) is only a fast-paint cache. |
| `src/services/demoEngine.ts` | Sample-data mode + the original local scoring engine (fallback/testing only, always labelled). |
| `src/types/index.ts` | All contracts (original types + v2: profile, ScoreOverview, ImprovementAnalysis, CareerRoadmap, preferences, jobs). |
| `src/components/OnboardingChoiceView.tsx` | Name + role → choice → Path A / Path B |
| `src/components/PathAResumeUpload.tsx` / `PathBManualDetails.tsx` | Resume upload / beginner details |
| `src/components/DashboardHome.tsx` + `AssessmentDashboard.tsx` | Score overview + breakdown (resume) or learning dashboard (beginner) |
| `src/components/SkillAnalysisTab.tsx` | Improvement analysis (+ "Want a roadmap?") |
| `src/components/LearningPathTab.tsx` | Roadmap with saved stage progress |
| `src/components/JobMatcherTab.tsx` / `NotificationsTab.tsx` | Job preferences + results / WhatsApp & Telegram alerts with explicit consent |
| `src/components/ResumeTab.tsx` | Every parsed resume field + replace |

`ProgressiveFlow.tsx`, `OnboardingChoice.tsx`, `FeatureSidebar.tsx`, `Navbar.tsx` are unused legacy screens (not imported anywhere). They still compile and can be deleted.
