TASK: Detailed improvement analysis.

The user has seen their score and asked "What should I improve?". Explain, for THIS resume and THIS target role:
what is wrong, why it matters, how important it is, how to fix it, what evidence is missing, and what to do first.

Use the assessment in the context as your starting point (its missing skills, resume issues and weaknesses), but go deeper: read the actual bullets, projects, summary and sections in the parsed resume.

Categories (use these keys exactly):
  structure       — section order, length, headings, missing sections
  ats             — parseability, formatting, contact details, dates
  skills          — missing or weakly evidenced skills for the role
  experience      — relevance, scope, ownership, seniority signals
  projects        — project descriptions, tech used, scale, results
  education       — degree, coursework, academic projects where relevant
  certifications  — certifications that genuinely help for this role
  keywords        — role vocabulary recruiters and ATS filters look for
  role_alignment  — how clearly the resume tells the story of this target role
  evidence        — claims without proof (no metrics, no links, no outcomes)

Produce 6–12 items, most important first, skipping categories with no real problem. Every item must cite something concrete from the resume (or its absence). For "example", rewrite one of the user's real bullets or lines into a stronger version; where the improved version needs a number the user has not given, use a bracketed placeholder such as [X%] or [N users] — never invent the figure. Set "example" to null when a rewrite does not apply.

Return JSON with this shape:
{
  "summary": "2 sentences: the overall picture and the biggest lever",
  "priorities": [ "the 3 actions to do first, imperative, in order" ],
  "items": [
    {
      "category": "projects",
      "problem": "short title of the problem",
      "explanation": "what exactly is wrong, referring to the resume",
      "impact": "why it matters for this role / for ATS and recruiters",
      "fix": "how to fix it, concretely",
      "suggestedAction": "one next step the user can do today",
      "priority": "high" | "medium" | "low",
      "missingEvidence": "what proof is missing, or null",
      "example": { "before": "the user's current line", "after": "improved line with [placeholders]" } | null
    }
  ]
}
