export interface ScoringBullet {
  bullet: string;
  score: number;
  section: string;
  roleIndex: number;
  bulletIndex: number;
  reasoning?: string;
}

export interface ScoringResponse {
  jobTitle: string;
  company: string;
  jdSummary: string;
  bullets: ScoringBullet[];
  keySkillsFound: string[];
  keySkillsMissing: string[];
  atsKeywordGaps: string[];
}

export interface SwapItem {
  id: string;
  action: "swap";
  section: string;
  roleIndex: number;
  bulletIndex: number;
  originalBullet: string;
  originalScore: number;
  newBullet: string;
  newScore: number;
  jdSkillsAddressed: string[];
  approved: boolean;
  userEdited?: string;
}

export interface SkillConfirm {
  skill: string;
  context: string;
  confirmed: boolean | null;
}

export interface DeEmphasisItem {
  id: string;
  section: string;
  roleIndex: number;
  bulletIndex: number;
  originalBullet: string;
  shortenedBullet: string;
  reason: string;
  approved: boolean;
}

export interface SwapResponse {
  swaps: SwapItem[];
  deEmphasis: DeEmphasisItem[];
  skillsToConfirm: SkillConfirm[];
}

export function parseAIJSON(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    return JSON.parse((fenced ? fenced[1] : raw).trim());
  } catch {
    throw new Error("Invalid JSON. Please copy the full JSON response from the AI assistant with no extra text.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}

function requireNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(message);
  return value;
}

function requireScore(value: unknown, label: string): number {
  const score = requireNumber(value, `${label} is missing score.`);
  if (score < 0 || score > 10) throw new Error("Score must be between 0 and 10.");
  return score;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function validateScoringResponse(raw: unknown): ScoringResponse {
  if (!isRecord(raw)) throw new Error("Please paste a valid scoring JSON object from the AI assistant.");
  if (!Array.isArray(raw.bullets)) throw new Error("Missing bullets array. Please copy the full scoring JSON from the AI assistant.");

  return {
    jobTitle: optionalString(raw.jobTitle),
    company: optionalString(raw.company),
    jdSummary: optionalString(raw.jdSummary),
    bullets: raw.bullets.map((item, index) => {
      const label = `Bullet #${index + 1}`;
      if (!isRecord(item)) throw new Error(`${label} must be an object.`);
      return {
        bullet: requireString(item.bullet, `${label} is missing bullet.`),
        score: requireScore(item.score, label),
        section: requireString(item.section, `${label} is missing section.`),
        roleIndex: requireNumber(item.roleIndex, `${label} is missing roleIndex.`),
        bulletIndex: requireNumber(item.bulletIndex, `${label} is missing bulletIndex.`),
        reasoning: typeof item.reasoning === "string" ? item.reasoning : undefined,
      };
    }),
    keySkillsFound: stringArray(raw.keySkillsFound),
    keySkillsMissing: stringArray(raw.keySkillsMissing),
    atsKeywordGaps: stringArray(raw.atsKeywordGaps),
  };
}

export function validateSwapResponse(raw: unknown): SwapResponse {
  if (!isRecord(raw)) throw new Error("Please paste a valid swap JSON object from the AI assistant.");
  if (!Array.isArray(raw.swaps)) throw new Error("Missing swaps array. Please copy the full swap JSON from the AI assistant.");

  return {
    swaps: raw.swaps.map((item, index) => {
      const label = `Swap #${index + 1}`;
      if (!isRecord(item)) throw new Error(`${label} must be an object.`);
      if (item.action !== "swap") throw new Error(`${label} action must be "swap".`);
      return {
        id: requireString(item.id, `${label} is missing id.`),
        action: "swap",
        section: requireString(item.section, `${label} is missing section.`),
        roleIndex: requireNumber(item.roleIndex, `${label} is missing roleIndex.`),
        bulletIndex: requireNumber(item.bulletIndex, `${label} is missing bulletIndex.`),
        originalBullet: requireString(item.originalBullet, `${label} is missing originalBullet.`),
        originalScore: requireScore(item.originalScore, label),
        newBullet: requireString(item.newBullet, `${label} is missing newBullet.`),
        newScore: requireScore(item.newScore, label),
        jdSkillsAddressed: stringArray(item.jdSkillsAddressed),
        approved: true,
      };
    }),
    deEmphasis: Array.isArray(raw.deEmphasis)
      ? raw.deEmphasis.map((item, index) => {
        const label = `De-emphasis #${index + 1}`;
        if (!isRecord(item)) throw new Error(`${label} must be an object.`);
        return {
          id: requireString(item.id, `${label} is missing id.`),
          section: requireString(item.section, `${label} is missing section.`),
          roleIndex: requireNumber(item.roleIndex, `${label} is missing roleIndex.`),
          bulletIndex: requireNumber(item.bulletIndex, `${label} is missing bulletIndex.`),
          originalBullet: requireString(item.originalBullet, `${label} is missing originalBullet.`),
          shortenedBullet: requireString(item.shortenedBullet, `${label} is missing shortenedBullet.`),
          reason: optionalString(item.reason),
          approved: true,
        };
      })
      : [],
    skillsToConfirm: Array.isArray(raw.skillsToConfirm)
      ? raw.skillsToConfirm.map((item, index) => {
        const label = `Skill confirmation #${index + 1}`;
        if (!isRecord(item)) throw new Error(`${label} must be an object.`);
        const confirmed: boolean | null = item.confirmed === true || item.confirmed === false ? item.confirmed : null;
        return {
          skill: requireString(item.skill, `${label} is missing skill.`),
          context: optionalString(item.context),
          confirmed,
        };
      })
      : [],
  };
}
