import { test } from "node:test";
import assert from "node:assert/strict";
import { validNickname, validateScore } from "../lib/validation.mjs";
test("nickname validation rejects abuse and impersonation", () => {
  for (const n of ["admin", "official1", "ahmed malik", "fuck", "a"])
    assert.throws(() => validNickname(n));
  assert.equal(validNickname("Chai champ"), "Chai champ");
});
const score = {
  score: 200,
  woken: 4,
  pops: 14,
  maxCombo: 3,
  powerupsUsed: 1,
  durationMs: 45000,
  earlyEnd: false,
};
test("valid round passes and impossible scores fail", () => {
  assert.equal(validateScore(score, 49000), true);
  assert.throws(() => validateScore({ ...score, score: 999999 }, 49000));
  assert.throws(() => validateScore(score, 1000));
  assert.throws(() => validateScore({ ...score, pops: -1 }, 49000));
  assert.throws(() => validateScore({ ...score, score: NaN }, 49000));
});
