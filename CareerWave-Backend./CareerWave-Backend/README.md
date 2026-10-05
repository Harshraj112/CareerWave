# Career Wave — Backend

One deployable service that replaces the separate Spring Boot API, Resume Parser and Web-Parsing/notification services:

```
React (Auth0 JWT) ──▶ Node gateway  src/server.js  (:8080)
                        ├─ /me/*                    profile + persisted state            src/routes/me.js
                        ├─ /resumes                 Resume Parser (extraction)           resume-parser/src/parser.js
                        ├─ /assessments             career agent: ATS score + gaps       src/ai/careerAgent.js
                        ├─ /analysis/improvements   career agent: what to fix
                        ├─ /roadmap                 career agent: resume + beginner modes
                        ├─ /jobs                    ranked jobs from the scraped catalog src/services/jobsService.js
                        │                             └─ runs web-parsing/scrape_india_jobs.py per target role
                        ├─ /users/me/*              preferences, Telegram, WhatsApp, job alerts
                        │                             └─ web-parsing/notification-service (FastAPI, started automatically)
                        └─ /api/*                   original Hecknex parser endpoints (unchanged contract)
```

**Extraction vs analysis.** `resume-parser` only extracts what is on the resume (plus its own heuristic ATS sub-scores). The career agent (`src/ai/`) receives `{ user, resume, assessment, preferences }` and produces the score overview, improvement analysis and roadmap. All AI output passes through `src/ai/normalize.js`, so the UI always receives the documented shape (e.g. `atsScore` always equals the sum of its five breakdown categories).

## Quick start

```bash
cp .env.example .env            # add AGENTROUTER_API_KEY, Auth0 domain/audience
npm install
pip install -r requirements.txt # scraper + notification service (Python 3.10+)
npm start                       # http://localhost:8080/health
```

Without Python the API still runs: jobs are served from the existing `web-parsing/output` catalog and alerts return a clear "unavailable" error.

**Docker (everything in one container):** `docker build -t careerwave-backend . && docker run -p 8080:8080 --env-file .env -v $PWD/data:/app/data careerwave-backend`. `render.yaml` deploys the same image with a persistent disk for `data/`.

## AI provider (server-side only)

| `AI_PROVIDER` | What runs |
|---|---|
| `agentrouter` (default) | AgentRouter, model `claude-opus-4.8`. `AGENTROUTER_API_STYLE=anthropic` → `POST /v1/messages`; `openai` → `POST /v1/chat/completions`. |
| `openrouter` | The original OpenRouter setup (`openai/gpt-6-luna`, same URL, headers, `response_format`). |
| `mock` | Deterministic offline data for tests. Every result is tagged `source: "mock"` and the UI labels it "Test data". |

The original OpenRouter implementation is preserved verbatim (commented out) at the bottom of `resume-parser/src/parser.js`; the live provider code is `resume-parser/src/ai-provider.js`.

> AgentRouter note: some users report AgentRouter rejecting requests that don't come from its officially supported coding tools. If you get 401/403 with a valid key, try the other `AGENTROUTER_API_STYLE`, or add headers with `AGENTROUTER_EXTRA_HEADERS`. Switching to `AI_PROVIDER=openrouter` needs no code change.

## API

All routes except `/health` and `/config` require `Authorization: Bearer <Auth0 access token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/me/state` | Everything the app persists (profile, resume, assessment, improvements, roadmap, progress, preferences) |
| PUT | `/me/profile` | `{ name, targetRole, path, experienceLevel, currentSkills, education, background, onboardingComplete }` |
| POST | `/resumes` | multipart `file` (PDF/DOCX/TXT/PNG/JPG, ≤10 MB), optional `role` — defaults to the profile's target role |
| GET / DELETE | `/resumes/current`, `/resumes/:id` | |
| POST | `/assessments` | Score the stored resume for the target role |
| POST | `/analysis/improvements` | Detailed problems + fixes (re-scores first if the role changed) |
| POST | `/roadmap` | `{ mode: "resume" }` or `{ mode: "beginner", targetRole, experienceLevel, skills, education?, background? }`. Response also contains the legacy `{ input_mode, target, roadmap: { stages: [{ stage_name, … }] } }` |
| PATCH | `/roadmap/progress` | `{ stageId, completed }` |
| GET | `/jobs` | Ranked jobs. Optional `role, locations, jobTypes, remote, limit` override saved preferences |
| POST | `/jobs/refresh` | Queue a scrape for the user's role |
| GET / PUT | `/users/me/preferences` | `{ jobSearch: { role, locations, remote, jobTypes }, notifications: { channel, whatsappNumber, telegramChatId, frequency, consent, enabled } }` |
| PUT | `/users/me/telegram`, `/users/me/whatsapp` | Existing endpoints: `{ chatId }` / `{ phoneNumber }` |
| POST | `/users/me/job-alerts` | Existing endpoint: send matching jobs now (requires consent) |
| POST | `/users/me/notifications/test` | Send a confirmation message |
| DELETE | `/users/me` | Delete all stored data for the user |
| POST | `/api/parse`, `/api/parse-profile`, `/api/batch-parse`; GET `/api/info` | Original Hecknex parser endpoints |

### Alerts and consent
Alerts can only be enabled when the request includes `consent: true` **and** a channel **and** a recipient. Withdrawing consent or removing the contact always disables sending. The scheduler (`ALERT_SCHEDULER_INTERVAL_MINUTES`) sends at most `JOBS_PER_ALERT` *new* jobs per daily/weekly digest and never repeats a job. WhatsApp Cloud API only delivers free-form text inside a 24-hour customer-service window — for cold, scheduled alerts you will need an approved message template.

### Data
Stored as one JSON file per user in `DATA_DIR` (atomic writes, per-user locking). Only structured resume data is kept, never the uploaded file. To move to a database, reimplement the four functions in `src/store.js`.

## Tests

```bash
npm test     # 15 tests: full API journeys (mock AI), consent rules, JWT verification, job ranking
```
