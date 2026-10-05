# Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Get Your Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key" or "Create new secret key"
3. Copy your API key

### 3. Configure Environment
```bash
# Edit .env file (it's already in your project)
GEMINI_API_KEY=your-actual-api-key-here
PORT=3000
```

### 4. Start the Server
```bash
npm start
```

You should see:
```
🚀 Hecknex Resume Parser API listening on port 3000
📖 Documentation: http://localhost:3000/api/info
```

### 5. Parse Your First Resume

**Option A: Via REST API** (in another terminal)
```bash
curl -X POST -F "file=@your-resume.pdf" http://localhost:3000/api/parse
```

**Option B: Via CLI**
You can run the CLI directly with Node or via `npm run`. When using `npm run` and passing additional flags (like `--role`), you must use `--` to forward them to the script.

Run directly with Node:
```bash
node src/cli.js your-resume.pdf --role SDE --json
```

Run via npm (forward args after `--`):
```bash
npm run parse -- your-resume.pdf --role SDE --json
```

There are also npm aliases:
```bash
# same as `npm run parse`
npm run cli -- your-resume.pdf --role SDE --json

# profile-only input (forward profile path after --)
npm run parse:profile -- profile.json --json
```

## Available Commands

```bash
# Start API server
npm start

# Start with auto-reload (development)
npm run dev

# Parse resume via CLI
npm run parse <filepath>

# Parse and save to JSON (use -- to forward flags)
npm run parse -- resume.pdf --output result.json

# Get raw JSON output
npm run parse -- resume.pdf --json
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Welcome message |
| `/health` | GET | Health check |
| `/api/info` | GET | API documentation |
| `/api/parse` | POST | Parse single resume |
| `/api/batch-parse` | POST | Parse multiple resumes |

## Example: cURL Requests

```bash
# Health check
curl http://localhost:3000/health

# Get API info
curl http://localhost:3000/api/info

# Parse single PDF
curl -X POST -F "file=@resume.pdf" http://localhost:3000/api/parse | jq

# Parse with output file
curl -X POST -F "file=@resume.pdf" http://localhost:3000/api/parse | jq > parsed.json

# Batch parse
curl -X POST \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf" \
  http://localhost:3000/api/batch-parse | jq
```

## Example: JavaScript/Node.js

```javascript
import { parseResumeFile } from "./src/parser.js";
import fs from "fs";

// Parse a resume file
const buffer = fs.readFileSync("resume.pdf");
const result = await parseResumeFile(
  buffer,
  "application/pdf",
  process.env.GEMINI_API_KEY
);

// Access parsed data
console.log(result.personal_info.full_name);
console.log(result.work_experience);
console.log(result.skills.technical);
```

## Supported File Formats

- 📄 **PDF** (.pdf) — Best for complex layouts
- 🖼️ **PNG** (.png) — Scanned resumes, documents
- 📷 **JPEG/JPG** (.jpg, .jpeg) — Photographs, scans
- 🎨 **WebP** (.webp) — Modern image format
- 🎬 **GIF** (.gif) — Animated images
- 📝 **Text** (.txt) — Pre-extracted text

## Output Example

```json
{
  "parsing_meta": {
    "is_resume": true,
    "warnings": []
  },
  "personal_info": {
    "full_name": "Jane Smith",
    "email": "jane.smith@example.com",
    "phone": "+1 (555) 987-6543",
    "location": "New York, NY",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "github_url": "https://github.com/janesmith",
    "portfolio_url": null,
    "other_links": []
  },
  "summary": "Senior Software Engineer with 8+ years...",
  "total_experience_years": 8.5,
  "work_experience": [
    {
      "company": "Tech Corp",
      "title": "Senior Engineer",
      "location": "New York, NY",
      "start_date": "2020-03",
      "end_date": "Present",
      "is_current": true,
      "employment_type": "Full-time",
      "description": [
        "Led team of 5 engineers...",
        "Architected microservices..."
      ],
      "skills_used": ["Python", "Kubernetes", "AWS"]
    }
  ],
  "education": [
    {
      "institution": "MIT",
      "degree": "Bachelor of Science",
      "field_of_study": "Computer Science",
      "location": "Cambridge, MA",
      "start_date": "2012",
      "end_date": "2016",
      "gpa": "3.8",
      "honors": ["Cum Laude"]
    }
  ],
  "skills": {
    "technical": ["Python", "Java", "Go", "Kubernetes", "AWS"],
    "tools": ["Docker", "GitHub", "Jira"],
    "soft": ["Leadership", "Communication"],
    "languages_spoken": ["English", "Spanish"]
  },
  "certifications": [],
  "projects": [],
  "publications": [],
  "awards": [],
  "volunteer_experience": []
}
```

## Troubleshooting

**API key error?**
- Check `.env` file exists and has `GEMINI_API_KEY=...`
- Restart the server after updating `.env`

**"Unsupported file type"?**
- Use: PDF, PNG, JPG, JPEG, WebP, GIF, or TXT
- Convert Word docs to PDF first

**Parsing seems slow?**
- Normal: 3-5 seconds for first parse
- Gemini API calls can take time
- Check your internet connection

**Poor parsing results?**
- Check `parsing_meta.warnings` in response
- Try `gemini-2.0-pro` (more capable but slower)
- Ensure resume is readable/not corrupted

## Next Steps

- 📚 Read [README.md](README.md) for full documentation
- 🔧 Customize [src/prompt.txt](src/prompt.txt) for your needs
- 🧪 Create test cases with sample resumes
- 🚀 Deploy to production (Vercel, Railway, Heroku, etc.)

## Need Help?

- Check existing issues on GitHub
- Review API response schema in README.md
- Enable debug logging if needed
- Test with a simple resume first

Happy parsing! 🎉
