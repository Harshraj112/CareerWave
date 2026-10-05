> **Career Wave:** this parser now runs inside the unified backend (`../src/server.js`, routes `/resumes` and `/api/*`).
> AI provider is switchable with `AI_PROVIDER=agentrouter|openrouter|mock` (see `src/ai-provider.js`); the original OpenRouter
> implementation is preserved, commented out, at the bottom of `src/parser.js`. It can still run standalone with `npm start` here.

# Hecknex Resume Parser

A powerful, Gemini-powered resume parsing engine that extracts structured information from resumes (PDF, images, or text) and returns validated JSON data.

## Features

✨ **Precise Extraction** — Only extracts information explicitly present in the resume
🎯 **Multi-format Support** — PDF, PNG, JPEG, WebP, GIF, and plain text
🔍 **Intelligent Parsing** — Handles multi-column layouts, tables, and complex formatting
📋 **Structured Output** — Well-defined JSON schema with categorized skills
✅ **Validation** — Post-processing validation for emails, phones, dates, and URLs
⚡ **Batch Processing** — Parse multiple resumes at once via API
🖥️ **CLI Tool** — Command-line interface for local file processing
🚀 **REST API** — Express.js server for programmatic access

## Deployment Notes

This project runs on Render as a standard Node.js web service. Set the environment variable `OPENROUTER_API_KEY` in the Render dashboard or via Render secrets, and let Render provide the `PORT` automatically.

## Project Structure

```
hecknex-resume-parser/
├── src/
│   ├── index.js           # Express API server
│   ├── cli.js             # Command-line interface
│   ├── parser.js          # Core parsing logic with Gemini
│   ├── validation.js      # Post-processing validation utilities
│   ├── schema.json        # Gemini response schema
│   └── prompt.txt         # Gemini system prompt
├── .env                   # Environment variables (API key)
├── .env.example           # Example environment file
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Installation

### Prerequisites
- Node.js 18+ and npm
- Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd hecknex-resume-parser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Copy the example file
   cp .env.example .env

   # Edit .env and add your Gemini API key
   GEMINI_API_KEY=your-api-key-here
   PORT=3000
   ```

## Usage

### REST API

Start the server:
```bash
npm start
```

The API will be available at `http://localhost:3000`

#### Endpoints

**Health Check**
```bash
curl http://localhost:3000/health
```

**Get API Info**
```bash
curl http://localhost:3000/api/info
```

**Parse Single Resume**
```bash
curl -X POST -F "file=@resume.pdf" http://localhost:3000/api/parse
```

**Batch Parse Multiple Resumes**
```bash
curl -X POST -F "files=@resume1.pdf" -F "files=@resume2.pdf" \
  http://localhost:3000/api/batch-parse
```

### CLI Tool

**Parse a resume and display formatted output**
```bash
npm run parse resume.pdf
```

**Parse and save to JSON file**
```bash
npm run parse resume.pdf --output parsed.json
```

**Output raw JSON only (useful for piping)**
```bash
npm run parse resume.pdf --json > output.json
```

**Supported file formats**
- `.pdf` — PDF documents
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` — Image files
- `.txt` — Plain text (already extracted)

## API Response Schema

All responses follow a consistent JSON structure:

```json
{
  "parsing_meta": {
    "is_resume": true,
    "warnings": []
  },
  "personal_info": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1 (555) 123-4567",
    "location": "San Francisco, CA",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "github_url": "https://github.com/johndoe",
    "portfolio_url": "https://johndoe.dev",
    "other_links": []
  },
  "summary": "...",
  "total_experience_years": 5,
  "work_experience": [...],
  "education": [...],
  "skills": {
    "technical": [],
    "tools": [],
    "soft": [],
    "languages_spoken": []
  },
  "certifications": [...],
  "projects": [...],
  "publications": [...],
  "awards": [...],
  "volunteer_experience": [...]
}
```

## Configuration

### Environment Variables

```bash
# .env file
GEMINI_API_KEY=your-api-key-here      # Required: Gemini API key
PORT=3000                              # Optional: Server port (default: 3000)
```

### Model Selection

Currently uses `gemini-2.0-flash` for faster parsing. For complex resumes, edit [src/parser.js](src/parser.js#L23) to use `gemini-2.0-pro`:

```javascript
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-pro", // Higher capability for complex layouts
  // ...
});
```

## Parsing Behavior

### Core Principles

1. **Extract, Don't Infer** — Only explicit information is extracted
2. **No Hallucination** — Missing fields are `null` or `[]`, never guessed
3. **Preserve Wording** — Original text is kept unless obvious OCR errors
4. **Handle Messy Layouts** — Multi-column, tables, and complex designs supported
5. **Standardized Dates** — All dates normalized to YYYY-MM or YYYY format
6. **Deduplicated Skills** — All skills collected and categorized from throughout document

### Validation & Post-Processing

After Gemini parsing, the results are validated:

- ✅ Email format validation (regex)
- ✅ Phone number validation & normalization (libphonenumber-js)
- ✅ Date range sanity checks (start ≤ end)
- ✅ URL format validation
- ✅ Total experience years computation from work dates

## Examples

### JavaScript/Node.js

```javascript
import { parseResumeFile } from "./src/parser.js";
import fs from "fs";

const fileBuffer = fs.readFileSync("resume.pdf");
const parsed = await parseResumeFile(
  fileBuffer,
  "application/pdf",
  process.env.GEMINI_API_KEY
);

console.log(parsed.personal_info.full_name);
console.log(parsed.work_experience[0].title);
```

### Using the API

```javascript
const formData = new FormData();
formData.append("file", resumeFile); // File from <input type="file">

const response = await fetch("http://localhost:3000/api/parse", {
  method: "POST",
  body: formData,
});

const result = await response.json();
console.log(result.data.personal_info);
```

## Advanced Customization

### Custom Prompt

Edit [src/prompt.txt](src/prompt.txt) to adjust parsing rules or add domain-specific instructions.

### Custom Schema

Modify [src/schema.json](src/schema.json) to add or remove fields. **Note:** You must also update the validation logic in [src/validation.js](src/validation.js).

### Custom Validation

Add custom validators in [src/validation.js](src/validation.js) and call them in the `postProcessParsedResume()` function.

## Testing

```bash
# Run tests (if available)
npm test

# Manual testing with sample resume
npm run parse sample-resume.pdf
```

## Troubleshooting

### "GEMINI_API_KEY not found"
- Ensure `.env` file exists in the project root
- Check that `GEMINI_API_KEY=...` is set correctly
- API key shouldn't have quotes around it

### "Unsupported file type"
- Supported formats: PDF, PNG, JPG, JPEG, WebP, GIF, TXT
- For Word documents (.docx), convert to PDF first

### "Failed to parse resume"
- Check that the resume is readable and not corrupted
- For PDFs with images/scans, ensure they're readable
- Try with `gemini-2.0-pro` model for complex layouts

### Low-quality parsing results
- Check `parsing_meta.warnings` for issues
- Consider using `gemini-2.0-pro` instead of `gemini-2.0-flash`
- Ensure resume is single-language (model may struggle with multilingual text)

## Performance

- **Single resume parsing**: ~3-5 seconds (depending on complexity)
- **Batch parsing**: ~2-3 seconds per resume
- **File size limit**: 10MB per file (Gemini API limit)

## Security

- API keys are never logged or displayed
- Files are processed in-memory and never stored on disk
- Consider rate-limiting and authentication in production

## License

MIT

## Support

For issues, questions, or feature requests, please open a GitHub issue.
# Resume-parser
