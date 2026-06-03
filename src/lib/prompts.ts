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
  return `You are a professional resume consultant. Generate targeted bullet improvements based on this scoring analysis. Return ONLY valid JSON — no explanation, no markdown, no code fences.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jdText}

SCORING ANALYSIS:
${JSON.stringify(scoring, null, 2)}

STRICT RULES:
- Only suggest swaps for bullets scoring BELOW 5
- Replacement bullets must be grounded in skills/experience already in the resume
- No invented metrics, fake numbers, or fabricated experience
- No em dashes (use commas or semicolons instead)
- No keyword stuffing
- If a JD skill is not evidenced anywhere in the resume, add it to skillsToConfirm instead
- No job title, date, company, or degree changes

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
  "skillsToConfirm": [
    {
      "skill": "Kubernetes",
      "context": "The JD requires Kubernetes but your resume doesn't mention it. Do you have this experience?",
      "confirmed": null
    }
  ]
}

Return ONLY the JSON object.`;
}
