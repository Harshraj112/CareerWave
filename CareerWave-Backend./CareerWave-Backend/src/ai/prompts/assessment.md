TASK: Resume-to-role assessment.

Answer the user's question: "How good is my resume for the job I want?"

Scoring — produce exactly these five breakdown categories (keys and max points are fixed):
  role_keywords        max 25  — does the resume use the vocabulary recruiters and ATS filters search for in this role?
  skills_coverage      max 25  — how many of the skills commonly required for this role are evidenced?
  experience_relevance max 20  — is the work/internship/project experience relevant to the role and its seniority?
  impact_evidence      max 15  — are achievements specific and quantified (scale, results, ownership)?
  ats_readability      max 15  — contact details, standard section headings, parseable layout, consistent dates.
"atsScore" MUST equal the sum of the five category scores. Use the parser's heuristic ATS sub-scores in the context as one input for ats_readability, but make your own judgement.

Calibration: 85–100 strong (ready to apply widely), 70–84 competitive (some fixable gaps), 50–69 developing (clear gaps for this role), below 50 needs work (major gaps or the resume targets a different role). A student with two relevant projects applying for an entry-level role can be "competitive"; the same resume for a senior role cannot.

Skills: "skillsMatched" are role-relevant skills with evidence in the resume — say where (e.g. "Used in the Inventory API project"). "skillsMissing" are skills commonly expected for this role with no evidence in the resume; mark importance high (most postings require it), medium (common) or low (nice to have). List at most 8 matched and 8 missing, most important first.

Return JSON with this shape:
{
  "atsScore": number,
  "scoreLabel": "Strong" | "Competitive" | "Developing" | "Needs work",
  "interpretation": "1–2 sentences that name the target role and the single most important thing holding the score back",
  "scoreBreakdown": [ { "key": "role_keywords", "label": "Role keywords", "score": number, "max": 25, "reason": "one sentence" }, ...all five... ],
  "skillsMatched": [ { "skill": string, "evidence": string } ],
  "skillsMissing": [ { "skill": string, "importance": "high" | "medium" | "low", "reason": string } ],
  "experienceAlignment": { "rating": "strong" | "partial" | "weak", "summary": "1–2 sentences", "relevantYears": number | null },
  "resumeIssues": [ { "issue": string, "severity": "high" | "medium" | "low" } ],
  "strengths": [ "3–4 short, specific strengths" ],
  "weaknesses": [ "3–4 short, specific weaknesses" ],
  "experienceLevel": "Beginner / Student" | "Entry-level (0-2 years)" | "Mid-level (3-5 years)" | "Senior (5+ years)"
}
