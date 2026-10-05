TASK: Personalized career roadmap.

Answer: "What should I learn, and in what order, to become ready for this role?"

The context says which mode applies:
- "resume" mode: the user has a resume and an assessment. Start from what the resume proves they already know, and build the roadmap around the assessment's missing skills and weaknesses. Do not re-teach skills they clearly have; at most include a short refresher stage if a fundamental is weakly evidenced.
- "beginner" mode: the user has no resume. Use their stated experience level, current skills and background as the starting point. If they are a complete beginner, begin with programming/tool fundamentals that the role actually requires.

Rules:
- 5–9 stages, ordered so every stage's prerequisites come earlier. Each stage is a coherent block of learning, not a single tool.
- Each stage gives: why it matters for THIS role (reason), priority, the concrete skills/topics, prerequisites, what the user can do afterwards (expectedOutcome), a realistic estimate for someone studying ~10–12 hours a week (estimatedTime as text and estimatedHours as a number), 1–2 concrete portfolio projects where they fit, and 2–4 well-known resources (type: course | book | docs | video | practice).
- Include a dedicated projects/portfolio stage and an interview preparation stage near the end unless the user is already past that point.
- "readinessMilestones" are checkpoints that tell the user they are job-ready (e.g. "Two deployed projects using X with READMEs").
- Estimates are approximate; say so in "totalEstimatedTime" (e.g. "about 6–8 months at 10 hrs/week").

Return JSON with this shape:
{
  "startingPoint": "1–2 sentences describing where the user is starting from",
  "summary": "1–2 sentences describing the path",
  "totalEstimatedTime": string,
  "stages": [
    {
      "title": "Stage title",
      "skills": [ "skill", ... ],
      "reason": "why this matters for the target role",
      "priority": "high" | "medium" | "low",
      "prerequisites": [ "..." ],
      "topics": [ "specific subtopics" ],
      "expectedOutcome": "what the user can do after this stage",
      "estimatedTime": "e.g. 3–4 weeks",
      "estimatedHours": number,
      "projects": [ { "title": string, "description": string } ],
      "resources": [ { "title": string, "type": "course" | "book" | "docs" | "video" | "practice", "provider": string | null, "url": string | null } ],
      "milestone": "how the user knows this stage is done"
    }
  ],
  "interviewPrep": { "topics": [ "..." ], "tips": [ "..." ] },
  "readinessMilestones": [ { "title": string, "criteria": string } ],
  "generalTips": [ "2–4 cross-cutting tips specific to this role" ]
}
