# Getting Started with Hecknex Resume Parser

## 📋 Complete Setup Checklist

### Phase 1: Verification (1 minute)

- [x] Node.js 18+ installed
- [x] npm or yarn available
- [x] Git installed (optional)
- [x] Project files downloaded/cloned
- [x] `.env` file with GEMINI_API_KEY exists

### Phase 2: Installation (2-3 minutes)

```bash
# Install dependencies
npm install
```

This will install:
- `@google/generative-ai` — Gemini API SDK
- `express` — Web server framework
- `multer` — File upload middleware
- `dotenv` — Environment variable loader
- `libphonenumber-js` — Phone validation

### Phase 3: Verify Configuration (30 seconds)

Check your `.env` file:
```bash
cat .env
# Should show:
# GEMINI_API_KEY=your-api-key
# PORT=3000
```

### Phase 4: Start the Server (30 seconds)

```bash
npm start
```

You should see:
```
🚀 Hecknex Resume Parser API listening on port 3000
📖 Documentation: http://localhost:3000/api/info
```

### Phase 5: Test the API (Open new terminal)

**Option A: Simple health check**
```bash
curl http://localhost:3000/health
# Returns: {"status":"ok","message":"Hecknex Resume Parser is running"}
```

**Option B: Get API documentation**
```bash
curl http://localhost:3000/api/info
# Returns detailed endpoint documentation
```

**Option C: Parse a resume via CLI**
```bash
npm run parse your-resume.pdf
```

## 🎯 Common First Tasks

### Task 1: Parse Your First Resume (3-5 seconds)

```bash
# Terminal 1: Keep API server running
npm start

# Terminal 2: Parse a resume
npm run parse your-resume.pdf
```

You'll see formatted output like:
```
📋 PERSONAL INFO:
  Name: John Doe
  Email: john@example.com
  ...

💼 WORK EXPERIENCE:
  1. Senior Engineer at Tech Corp
  ...
```

### Task 2: Get JSON Output

```bash
npm run parse resume.pdf --json > result.json
```

Or via API:
```bash
curl -X POST -F "file=@resume.pdf" http://localhost:3000/api/parse > result.json
```

### Task 3: Process Multiple Resumes

```bash
curl -X POST \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.pdf" \
  http://localhost:3000/api/batch-parse
```

## 🗂️ Project Structure Overview

```
hecknex-resume-parser/
│
├── 🚀 src/                          # Application code
│   ├── index.js                     # Express API server
│   ├── cli.js                       # Command-line tool
│   ├── parser.js                    # Core Gemini integration
│   ├── validation.js                # Data validation
│   ├── schema.json                  # Response schema
│   └── prompt.txt                   # Gemini system prompt
│
├── 📚 Documentation                 # Essential reading
│   ├── README.md                    # Full documentation
│   ├── QUICKSTART.md               # 5-minute guide
│   ├── DEPLOYMENT.md               # Production setup
│   ├── PROJECT_STATUS.md           # Project overview
│   └── GETTING_STARTED.md          # This file
│
├── ⚙️ Configuration
│   ├── .env                         # API keys (your config)
│   ├── .env.example                 # Template
│   ├── .gitignore                   # Git rules
│   └── package.json                 # Dependencies
│
├── 💡 Examples & Testing
│   ├── examples.js                  # Code examples
│   ├── Postman_Collection.json     # API test suite
│   └── setup.sh                     # Setup helper
│
└── 📄 This Folder               # You are here!
```

## 📡 API Endpoint Reference

### Base URL
```
http://localhost:3000  (development)
https://your-domain.com (production)
```

### All Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Welcome |
| GET | `/health` | Status check |
| GET | `/api/info` | Documentation |
| POST | `/api/parse` | Parse single file |
| POST | `/api/batch-parse` | Parse multiple files |

### Example: Parse Single Resume

```bash
curl -X POST \
  -F "file=@resume.pdf" \
  http://localhost:3000/api/parse

# Returns:
# {
#   "success": true,
#   "data": {
#     "parsing_meta": {...},
#     "personal_info": {...},
#     "work_experience": [...],
#     ...
#   }
# }
```

## 🎨 Command-Line Interface

### Parse and Display

```bash
npm run parse resume.pdf
```

### Parse and Save JSON

```bash
npm run parse resume.pdf --output result.json
```

### Raw JSON Only

```bash
npm run parse resume.pdf --json
```

### Get Help

```bash
npm run parse --help
```

## 🛠️ Development Mode

Auto-reload on file changes:

```bash
npm run dev
```

## 🧪 Testing Your Setup

### Test 1: Server Is Running

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok",...}`

### Test 2: File Upload Works

```bash
# Create a test file
echo "JOHN DOE\njohn@example.com\nSoftware Engineer at ABC Corp" > test.txt

# Test the endpoint
npm run parse test.txt
```

### Test 3: Batch Processing

```bash
curl -X POST \
  -F "files=@test1.txt" \
  -F "files=@test2.txt" \
  http://localhost:3000/api/batch-parse | jq
```

## 📖 Documentation Map

| Document | Purpose | Read Time |
|----------|---------|-----------|
| README.md | Complete reference | 15 min |
| QUICKSTART.md | Fast setup | 5 min |
| DEPLOYMENT.md | Go to production | 20 min |
| PROJECT_STATUS.md | Project overview | 10 min |
| examples.js | Code samples | 10 min |
| This file | Getting started | 5 min |

## ⚙️ Configuration Options

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key

# Optional
PORT=3000                    # Server port
NODE_ENV=production         # Environment
LOG_LEVEL=info             # Logging level
```

### Model Selection

Edit `src/parser.js` line 23:

```javascript
// Fast (3-5 sec): Use for most cases
model: "gemini-2.0-flash"

// Accurate (slower): Use for complex layouts
model: "gemini-2.0-pro"
```

## 🚀 Next Steps

### Short Term (Today)
1. ✅ Set up the project
2. ✅ Parse your first resume
3. ✅ Explore the REST API

### Medium Term (This Week)
1. Read full documentation
2. Try code examples
3. Customize for your needs
4. Set up Postman collection

### Long Term (This Month)
1. Deploy to production
2. Integrate into your app
3. Set up monitoring
4. Automate bulk processing

## 🆘 Quick Troubleshooting

### "API key not found"
```bash
# Check .env file
cat .env

# Should show GEMINI_API_KEY=...
# If not, edit .env and add it
```

### "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### API returns 500 error
```bash
# Check server logs (visible in terminal)
# Common issues:
# - Invalid API key
# - No internet connection
# - API quota exceeded
```

### Parsing is very slow
```bash
# Normal: 3-5 seconds per resume
# If slower: check network and API status
# Switch to gemini-2.0-flash if using pro
```

### "Unsupported file type"
```bash
# Supported: PDF, PNG, JPEG, WebP, GIF, TXT
# Convert other formats to PDF first
```

## 💡 Pro Tips

### Tip 1: Use the JSON Output for Integration
```bash
npm run parse resume.pdf --json | jq '.personal_info'
```

### Tip 2: Process Batch Files
```bash
for file in *.pdf; do
  npm run parse "$file" --output "parsed_${file%.*}.json"
done
```

### Tip 3: Save Parse Results
```bash
npm run parse resume.pdf --output parsed.json
```

### Tip 4: Test with curl
```bash
curl -X POST -F "file=@resume.pdf" http://localhost:3000/api/parse | jq
```

### Tip 5: Monitor API Health
```bash
watch curl -s http://localhost:3000/health
```

## 🔒 Security Reminders

- ✅ Never commit `.env` file
- ✅ Never expose API keys in logs
- ✅ Always use HTTPS in production
- ✅ Set up rate limiting for production
- ✅ Validate file uploads
- ✅ Use environment variables for secrets

## 📞 Getting Help

1. **Read the docs** — Most questions answered in README.md
2. **Check examples** — See examples.js for code samples
3. **Review logs** — Terminal output shows what's happening
4. **Test step-by-step** — Isolate the issue
5. **Search issues** — Check GitHub for known problems

## ✅ Success Checklist

- [ ] Node.js installed and verified
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with API key
- [ ] Server starts without errors (`npm start`)
- [ ] Health check passes (`curl /health`)
- [ ] CLI works (`npm run parse test.txt`)
- [ ] API works (`curl -X POST -F "file=@..."`)
- [ ] Can parse your own resume successfully
- [ ] JSON output is valid
- [ ] Ready to deploy or integrate!

## 🎉 You're All Set!

Your Hecknex Resume Parser is ready to use. Choose your next step:

**Option A: Integrate Into Your App**
- Use REST API from web/mobile
- Use parser module in Node.js
- See examples.js for code samples

**Option B: Deploy to Production**
- Follow DEPLOYMENT.md guide
- Choose your platform (Vercel, Railway, AWS, etc.)
- Enable monitoring and logging

**Option C: Explore & Customize**
- Read full documentation
- Modify prompt.txt for custom rules
- Add custom validations
- Create test suite

---

**Start Now:** `npm start` then open http://localhost:3000/api/info

Happy parsing! 🚀
