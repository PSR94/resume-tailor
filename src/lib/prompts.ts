export function buildScoringPrompt(resumeText: string, jdText: string): string {
  return `You are a professional resume consultant. Analyze this resume against the job description and return ONLY valid JSON — no explanation, no markdown, no code fences.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

Return this exact JSON structure:
{
  "jobTitle": "extracted job title",
  "company": "extracted company name",
  "jdSummary": "2-3 sentence summary of what this role requires",
  "bullets": [
    {
      "bullet": "exact bullet text from resume",
      "score": 7,
      "section": "Experience",
      "roleIndex": 0,
      "bulletIndex": 0,
      "reasoning": "brief reason for score"
    }
  ],
  "keySkillsFound": ["skills well covered in resume"],
  "keySkillsMissing": ["important JD skills not in resume"],
  "atsKeywordGaps": ["keywords in JD missing entirely from resume"]
}

Scoring rules:
- 0–3: Not relevant to this role
- 4–6: Tangentially relevant
- 7–8: Directly relevant
- 9–10: Perfectly aligned with a top requirement

Score EVERY bullet in the resume. Return ONLY the JSON object.`;
}

export function buildSwapPrompt(resumeText: string, jdText: string, scoring: unknown): string {
  return `You are a professional resume consultant. Generate targeted bullet improvements and de-emphasis suggestions based on this scoring analysis. Return ONLY valid JSON — no explanation, no markdown, no code fences.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

SCORING ANALYSIS:
${JSON.stringify(scoring, null, 2)}

STRICT RULES — follow every one without exception:

Content rules:
- Only suggest swaps for bullets scoring BELOW 5
- Replacement bullets must be grounded in skills and experience already present in the resume
- Do not invent metrics, numbers, percentages, team sizes, savings, impact, or performance improvements
- Do not infer experience from company name, industry, role title, or adjacent work
- Do not add any tool, platform, framework, skill, or domain that is not clearly supported by the resume — add it to skillsToConfirm instead
- Do not change job titles, role titles, company names, employment dates, locations, degree names, university names, or certification names
- Do not add content that would be difficult to defend in an interview

Language and tone rules:
- Write in a natural, human, professional tone — not AI-generated, robotic, or generic
- Do not directly copy or lightly paraphrase phrases from the job description into bullets
- Do not use em dashes — use commas or semicolons instead
- Do not stuff multiple tools, technologies, or keywords into a single bullet
- Keep each bullet focused on one clear contribution or outcome
- Maintain consistent tone, detail level, and structure across all roles and sections
- Do not make some bullets very detailed and others too short
- Avoid repeating the same tools, phrases, or responsibilities across multiple bullets

Balance rules:
- Do not over-focus on one technology, platform, or domain
- Where the JD focuses on a specific stack (e.g. AWS, Python), increase emphasis only where supported by the resume
- Where the resume is heavy on a stack less relevant to this JD (e.g. Azure-heavy resume for an AWS role), suggest de-emphasising those bullets via the deEmphasis array — do not remove them

De-emphasis rules:
- Use deEmphasis for bullets that are high-scoring but over-detailed on a stack less central to this JD
- The shortened version should retain the key point but reduce the stack-specific detail
- Do not remove bullets entirely — only shorten or lighten them
- Keep the shortened version truthful and interview-safe

Return this exact JSON structure:
{
  "swaps": [
    {
      "id": "swap_0",
      "action": "swap",
      "section": "Experience",
      "roleIndex": 0,
      "bulletIndex": 2,
      "originalBullet": "exact original bullet text",
      "originalScore": 3,
      "newBullet": "improved replacement bullet",
      "newScore": 8,
      "jdSkillsAddressed": ["skill1", "skill2"],
      "approved": true
    }
  ],
  "deEmphasis": [
    {
      "id": "de_0",
      "section": "Experience",
      "roleIndex": 1,
      "bulletIndex": 0,
      "originalBullet": "exact original bullet text",
      "shortenedBullet": "shorter version with less stack-specific detail",
      "reason": "Azure-heavy detail less relevant for this AWS-focused role"
    }
  ],
  "skillsToConfirm": [
    {
      "skill": "Kubernetes",
      "context": "The JD requires Kubernetes but your resume does not mention it. Do you have this experience?",
      "confirmed": null
    }
  ]
}

Return ONLY the JSON object.`;
}
