# Deployment Guide

This guide covers deploying Hecknex Resume Parser to production environments.

## Prerequisites

- Node.js 18+ installed
- Gemini API key with active quota
- Deployment platform account (Vercel, Railway, Heroku, AWS, etc.)
- Git repository (GitHub, GitLab, Bitbucket)

## Environment Variables

Create a `.env` file in production with:

```bash
OPENROUTER_API_KEY=your-production-api-key
PORT=3000
NODE_ENV=production
```

**Security Note:** Never commit `.env` files. Use your platform's secrets management.

## Platform-Specific Deployment

### Vercel (Recommended for REST API)

**Step 1: Prepare for Vercel**

Create `vercel.json` in project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ],
  "env": {
    "GEMINI_API_KEY": "@gemini-api-key",
    "NODE_ENV": "production"
  }
}
```

**Step 2: Deploy**

```bash
npm install -g vercel
vercel login
vercel deploy
```

**Step 3: Set Secrets**

```bash
vercel env add GEMINI_API_KEY
# Enter your production API key when prompted
```

**Step 4: Redeploy with secrets**

```bash
vercel deploy --prod
```

Your API will be available at: `https://your-project.vercel.app`

### Railway

**Step 1: Connect GitHub**

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Select your repository

**Step 2: Add environment variables**

In Railway dashboard:
1. Go to Variables tab
2. Add `GEMINI_API_KEY` with your production key
3. Add `NODE_ENV=production`

**Step 3: Configure start command**

In Service settings → Deploy:
- Build Command: `npm install`
- Start Command: `npm start`

Your API will be available at: `https://your-project.railway.app`

### Heroku

**Step 1: Install Heroku CLI**

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Linux/WSL
curl https://cli-assets.heroku.com/install.sh | sh

# Windows (use installer from heroku.com/windows)
```

**Step 2: Create Heroku app**

```bash
heroku login
heroku create your-app-name
```

**Step 3: Set environment variables**

```bash
heroku config:set GEMINI_API_KEY=your-api-key
heroku config:set NODE_ENV=production
```

**Step 4: Create Procfile**

```bash
echo "web: node src/index.js" > Procfile
```

**Step 5: Deploy**

```bash
git push heroku main
```

View logs:

```bash
heroku logs --tail
```

Your API will be available at: `https://your-app-name.herokuapp.com`

### AWS (EC2 + Docker)

**Step 1: Create Dockerfile**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: Create `.dockerignore`**

```
node_modules
npm-debug.log
.git
.gitignore
.env
README.md
.DS_Store
coverage
tests
```

**Step 3: Build and push to ECR**

```bash
# Login to AWS
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t hecknex-parser .

# Tag image
docker tag hecknex-parser:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/hecknex-parser:latest

# Push to ECR
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/hecknex-parser:latest
```

**Step 4: Launch EC2 instance**

1. Go to AWS EC2 dashboard
2. Launch instance with Amazon Linux or Ubuntu
3. Set security group to allow port 3000
4. Install Docker on instance
5. Pull and run container:

```bash
docker run -e GEMINI_API_KEY=your-key -p 3000:3000 your-ecr-uri/hecknex-parser:latest
```

### Google Cloud Run (Recommended for serverless)

**Step 1: Create `cloudbuild.yaml`**

```yaml
steps:
  - name: "gcr.io/cloud-builders/docker"
    args:
      - "build"
      - "-t"
      - "gcr.io/$PROJECT_ID/hecknex-parser"
      - "."

  - name: "gcr.io/cloud-builders/docker"
    args:
      - "push"
      - "gcr.io/$PROJECT_ID/hecknex-parser"

  - name: "gcr.io/cloud-builders/run"
    args:
      - "deploy"
      - "hecknex-parser"
      - "--image"
      - "gcr.io/$PROJECT_ID/hecknex-parser"
      - "--region"
      - "us-central1"
      - "--set-env-vars"
      - "GEMINI_API_KEY=${_GEMINI_API_KEY}"
      - "--allow-unauthenticated"
```

**Step 2: Deploy**

```bash
gcloud builds submit --substitutions=_GEMINI_API_KEY="your-api-key"
```

Your API will be available at: `https://hecknex-parser-xxxxx-uc.a.run.app`

## Docker Deployment (General)

**Step 1: Create Dockerfile** (see AWS section above)

**Step 2: Build image**

```bash
docker build -t hecknex-parser:latest .
```

**Step 3: Run locally**

```bash
docker run -e GEMINI_API_KEY=your-key -p 3000:3000 hecknex-parser:latest
```

**Step 4: Test API**

```bash
curl http://localhost:3000/health
```

## Performance Optimization

### Enable Caching

Add to `src/index.js`:

```javascript
app.get("/api/info", (req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({
    // ... info
  });
});
```

### Implement Rate Limiting

```javascript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

Install: `npm install express-rate-limit`

### Add Timeouts

```javascript
app.post("/api/parse", upload.single("file"), async (req, res) => {
  const timeout = setTimeout(() => {
    res.status(504).json({ error: "Request timeout" });
  }, 30000); // 30 second timeout

  try {
    const parsed = await parseResumeFile(/* ... */);
    clearTimeout(timeout);
    res.json({ success: true, data: parsed });
  } catch (error) {
    clearTimeout(timeout);
    res.status(500).json({ error: error.message });
  }
});
```

## Monitoring & Logging

### Add Logging Middleware

```javascript
import morgan from "morgan";

app.use(morgan("combined"));
```

Install: `npm install morgan`

### Monitor with Sentry

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Health Check Endpoint

Already included in `src/index.js` at `/health`. Use with:

```bash
# For Heroku/Platform.sh/etc.
curl https://your-domain.com/health
```

## Database Logging (Optional)

To save parse results, add MongoDB connection:

```javascript
import mongoose from "mongoose";

const parseResultSchema = new mongoose.Schema({
  filename: String,
  personal_info: Object,
  work_experience: Array,
  skills: Object,
  created_at: { type: Date, default: Date.now },
});

const ParseResult = mongoose.model("ParseResult", parseResultSchema);

// In parse endpoint:
const doc = new ParseResult(parsed);
await doc.save();
```

## Security Checklist

- [ ] API key stored in environment variables, not code
- [ ] `.env` added to `.gitignore`
- [ ] HTTPS enforced in production
- [ ] CORS configured if needed: `app.use(cors())`
- [ ] Rate limiting enabled
- [ ] Request size limits set: `app.use(express.json({ limit: "10mb" }))`
- [ ] Health check endpoint configured
- [ ] Error handling doesn't leak sensitive info
- [ ] Logs sanitized (no API keys logged)
- [ ] Regular security updates: `npm audit`

## Scaling Considerations

### Horizontal Scaling

Most platforms support auto-scaling:

**Vercel**: Automatic (serverless)
**Railway**: Set instances in dashboard
**Heroku**: Use `Procfile` with multiple worker types
**AWS**: Use load balancer + auto-scaling groups

### Queue System (for heavy load)

For very high volume, add job queue:

```javascript
import Bull from "bull";

const parseQueue = new Bull("parse", {
  redis: { host: "127.0.0.1", port: 6379 },
});

parseQueue.process(async (job) => {
  return await parseResumeFile(
    job.data.buffer,
    job.data.mimeType,
    process.env.GEMINI_API_KEY
  );
});

app.post("/api/parse", upload.single("file"), async (req, res) => {
  const job = await parseQueue.add({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
  });

  res.json({ jobId: job.id, status: "queued" });
});
```

## Rollback Strategy

**Vercel**:
```bash
vercel rollback
```

**Heroku**:
```bash
heroku releases
heroku rollback v4
```

**AWS**:
- Keep previous Docker image tags
- Update ECS task definition to previous version

## CI/CD Pipeline

**GitHub Actions Example** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm ci
      - run: npm test
      - run: npx vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

## Troubleshooting Production Issues

### API responds with 500 errors

1. Check logs: `vercel logs` or `heroku logs --tail`
2. Verify GEMINI_API_KEY is set
3. Check Gemini API quota
4. Ensure internet connection

### Slow response times

1. Check Gemini API latency
2. Monitor file size (> 10MB will fail)
3. Consider using `gemini-2.0-flash` (faster) instead of pro
4. Enable caching for `/api/info`

### Out of memory

1. Reduce max file size
2. Add memory limits in Dockerfile
3. Implement streaming for large files
4. Use serverless with auto-scaling

## Support

For deployment issues:
- Check platform-specific documentation
- Review logs carefully
- Test locally first
- Ask in GitHub discussions
