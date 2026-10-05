# Career Wave v2 — what changed and why

## Structure
- **Frontend** — the existing React app, modified in place (same design system, Auth0 kept).
- **Backend** — one Node service (`backend/src/server.js`) containing the Resume Parser (`backend/resume-parser`) and the Web Parser + notification service (`backend/web-parsing`, still Python because JobSpy is Python-only; the backend starts and schedules them).
- The frontend previously called a Spring Boot API that was not in the provided code. The backend now implements that API (`/resumes`, `/roadmap`, `/users/me/telegram`, `/users/me/whatsapp`, `/users/me/job-alerts`) plus the new endpoints.

## Product flow
- After Auth0 sign-in: **name + target role** (predefined or custom), then "Do you already have a resume?". The role is saved on the server and reused everywhere; resume users are never asked for it again.
- **Resume path:** upload → Resume Parser → AI assessment → overview (target role, ATS score, interpretation, strengths, gaps) → full breakdown → "Want to know what to improve?" → AI improvement analysis by category → "Want a roadmap?" → personalised roadmap → jobs → alerts.
- **Beginner path:** experience level + current skills (+ optional education/background) → AI roadmap → learning dashboard → jobs → alerts. No ATS score is produced.
- Terminology standardised to **ATS score** everywhere.
- Changing the target role flags existing results as out of date and offers a one-click re-score/re-analysis.

## AI
- AgentRouter (`claude-opus-4.8`) is the active provider; OpenRouter remains available (`AI_PROVIDER=openrouter`) and its original code is preserved, commented, in `parser.js`. Keys exist only on the server.
- Extraction (parser) is separated from analysis (career agent: assessment, improvements, roadmap).
- `schema.json` is now actually sent to the model, so the response shape is stable.
- The old local scoring in `ApiService.createAssessment()` is no longer the primary path; it lives in `demoEngine.ts` as a labelled fallback.

## Bugs fixed in the original code
| Where | Problem | Fix |
|---|---|---|
| `OnboardingChoiceView` | Upload never sent the selected role to the parser | Role applied server-side from the profile |
| `PathBManualDetails` | Sent job alerts to two **hardcoded phone numbers** without the user's consent | Removed; alerts require the user's own contact + explicit consent |
| `pdf-extractor.js` | `import "pdf-parse"` runs pdf-parse's self-test under ESM and crashes on first PDF | Load `pdf-parse/lib/pdf-parse.js` |
| `validation.js` | Validated top-level `personal_info`, but the model nests it in `resume_data` → validation never ran; crashed if `warnings` missing | Handles the envelope; initialises warnings |
| `validation.js` | Phone numbers without a country code were parsed as US and dropped | Default region `IN` (configurable); original kept if unparseable |
| `parser.js` | Prompt text was fed into the "missing sections" regex fallback | Uses resume text only |
| Upload UI | Advertised DOCX/TXT, parser rejected them | DOCX (mammoth) and TXT supported |
| `scrape_india_jobs.py` | "Credibility" score was `random.randint(55, 90)`, re-rolled on every read and shown to users in alerts | Deterministic score from listing completeness |
| `scrape_india_jobs.py` | FastAPI `/jobs` called `parse_args()` inside uvicorn (reads uvicorn's flags) | Uses defaults |
| `notification-service` | Missing token for *either* channel crashed the whole service at import | Each channel enabled independently; 503 for an unconfigured channel |
| `notification-service` | Telegram uses `parse_mode=HTML` without escaping; `&`/`<` in a job broke delivery | HTML-escaped |
| Dashboard | Hardcoded 68% match, Amazon interview, notification badge "3", "API Connected" and "Harsh Raj" fallback name | Replaced with real data / real backend status |
| `App.tsx` | Fake notification list | Real job-alert settings screen |
| Local cache | Not namespaced per user; stale localStorage could override server data | Per-user cache, backend always wins, cleared on sign-out |

## Mock / demo data
Kept for testing, never presented as real: "Try with a sample resume", `VITE_DEMO_MODE=true`, or `AI_PROVIDER=mock`. Every such result carries a visible "Sample data" / "Test data" badge.

## Verification done
- Backend: 15 automated tests (`npm test`) — both journeys, stale-role regeneration, consent rules, legacy endpoints, Auth0 RS256 verification, job ranking.
- Wire format checked against a capture server for AgentRouter (both styles) and OpenRouter.
- Frontend: `tsc` + production build clean; browser end-to-end run (Chromium) of the resume journey, beginner journey, refresh persistence, role change → re-score, job search on the real scraped catalog, alerts with consent (against a stand-in notification service), sample mode, and mobile layout.

## Not verified here (no network in the build environment)
- Live calls to AgentRouter / OpenRouter, Auth0, Telegram and WhatsApp, and a live JobSpy scrape. Test these with real keys first; see the AgentRouter note in `backend/README.md`.
- `npm install` / `pip install` were not run; dependency versions are pinned in `package.json` / `requirements.txt`.
