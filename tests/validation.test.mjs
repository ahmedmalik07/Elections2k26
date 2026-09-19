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
const run = {
  mode: "dash",
  score: 2150,
  votes: 20,
  distance: 850,
  points: 1300,
  collabs: 1,
  durationMs: 30000,
};
test("campus dash runs are checked against speed, spawn and scoring limits", () => {
  assert.equal(validateScore(run, 31000, "dash"), true);
  assert.throws(() => validateScore({ ...run, score: 5000 }, 31000, "dash"));
  assert.throws(() =>
    validateScore({ ...run, distance: 5000, score: 6300 }, 31000, "dash"),
  );
  assert.throws(() =>
    validateScore({ ...run, points: 90000, score: 90850 }, 31000, "dash"),
  );
  assert.throws(() =>
    validateScore(
      { ...run, collabs: 9, points: 3200, score: 4050 },
      31000,
      "dash",
    ),
  );
  assert.throws(() =>
    validateScore({ ...run, points: undefined }, 31000, "dash"),
  );
  assert.throws(() => validateScore(run, 10000, "dash"));
});

test("long endless runs and delayed uploads keep their earned scores", () => {
  const long = {
    ...run,
    durationMs: 12 * 3600000,
    distance: 1700000,
    votes: 72000,
    points: 9000000,
    collabs: 1000,
    score: 10700000,
  };
  assert.equal(validateScore(long, 12 * 3600000 + 1000, "dash"), true);
  assert.equal(validateScore(long, 30 * 86400000, "dash"), true);
  assert.throws(() => validateScore(long, 1000, "dash"));
  assert.throws(() =>
    validateScore(
      { ...long, durationMs: 25 * 3600000 },
      25 * 3600000 + 1000,
      "dash",
    ),
  );
  assert.throws(() => validateScore(long, 32 * 86400000, "dash"));
});
