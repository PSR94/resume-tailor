import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outDir = join(tmpdir(), "resume-tailor-validation-test");
rmSync(outDir, { recursive: true, force: true });

execFileSync(
  "./node_modules/.bin/tsc",
  ["src/lib/validation.ts", "--target", "ES2020", "--module", "commonjs", "--outDir", outDir, "--skipLibCheck"],
  { stdio: "inherit" },
);

const require = createRequire(import.meta.url);
const { parseChatGPTJSON, validateScoringResponse, validateSwapResponse } = require(join(outDir, "validation.js"));

const scoringBullet = {
  bullet: "Built Python services.",
  score: 7,
  section: "EXPERIENCE",
  roleIndex: 0,
  bulletIndex: 0,
};

const swapItem = {
  id: "swap_0",
  action: "swap",
  section: "EXPERIENCE",
  roleIndex: 0,
  bulletIndex: 0,
  originalBullet: "Built Python services.",
  originalScore: 3,
  newBullet: "Built targeted Python automation services.",
  newScore: 8,
};

function expectError(fn, message) {
  assert.throws(fn, (error) => error instanceof Error && error.message === message);
}

assert.deepEqual(parseChatGPTJSON('{"ok":true}'), { ok: true });
assert.deepEqual(parseChatGPTJSON('```json\n{"ok":true}\n```'), { ok: true });
expectError(
  () => parseChatGPTJSON("{"),
  "Invalid JSON. Please copy the full JSON response from ChatGPT with no extra text.",
);

const scoring = validateScoringResponse({
  jobTitle: "",
  company: "",
  jdSummary: "",
  bullets: [scoringBullet],
});
assert.equal(scoring.bullets.length, 1);
assert.deepEqual(scoring.keySkillsFound, []);
assert.deepEqual(scoring.keySkillsMissing, []);
assert.deepEqual(scoring.atsKeywordGaps, []);

expectError(
  () => validateScoringResponse({ jobTitle: "Engineer" }),
  "Missing bullets array. Please copy the full scoring JSON from ChatGPT.",
);
expectError(
  () => validateScoringResponse({ bullets: [{ ...scoringBullet, score: 11 }] }),
  "Score must be between 0 and 10.",
);
expectError(
  () => validateScoringResponse({ bullets: [{ ...scoringBullet, score: undefined }] }),
  "Bullet #1 is missing score.",
);

const swaps = validateSwapResponse({
  swaps: [swapItem],
  skillsToConfirm: [{ skill: "Kubernetes", context: "Mentioned in JD" }],
});
assert.deepEqual(swaps.swaps[0].jdSkillsAddressed, []);
assert.equal(swaps.swaps[0].approved, true);
assert.deepEqual(swaps.skillsToConfirm, [{ skill: "Kubernetes", context: "Mentioned in JD", confirmed: null }]);

assert.deepEqual(validateSwapResponse({ swaps: [swapItem] }).skillsToConfirm, []);
expectError(
  () => validateSwapResponse({}),
  "Missing swaps array. Please copy the full swap JSON from ChatGPT.",
);
expectError(
  () => validateSwapResponse({ swaps: [{ ...swapItem, newBullet: "" }] }),
  "Swap #1 is missing newBullet.",
);
expectError(
  () => validateSwapResponse({ swaps: [{ ...swapItem, action: "insert" }] }),
  'Swap #1 action must be "swap".',
);

console.log("Frontend validation tests passed.");
