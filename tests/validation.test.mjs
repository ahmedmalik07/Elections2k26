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

// A real run that was refused by the old 30-minute cap and lost: 1,001,245
// points over 101,720 m with 6,416 votes, which needs ~39 minutes of play.
// The player saw "Couldn't reach the leaderboard" and the score never existed
// on the server. Nothing may ever reject an honest endurance run again.
test("the 1,001,245 endurance run that was rejected before is accepted", () => {
  const distance = 101720;
  const votes = 6416;
  const score = 1001245;
  // Speed ramps 22 -> 44 m/s over the first 110s, so this far takes ~39 min.
  const seconds = (distance + 1210) / 44;
  const durationMs = Math.round(seconds * 1000);
  const millionRun = {
    ...run,
    score,
    votes,
    points: score - distance,
    collabs: 100,
    distance,
    durationMs,
  };
  assert.ok(seconds / 60 > 30, "this run is longer than the old 30-minute cap");
  assert.equal(validateScore(millionRun, durationMs + 500, "dash"), true);
  // And still accepted when the phone only gets to upload it hours later.
  assert.equal(validateScore(millionRun, 6 * 3600000, "dash"), true);
});
