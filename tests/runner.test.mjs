import test from "node:test";
import assert from "node:assert/strict";
import {
  runnerScore,
  runnerCollision,
  runnerRow,
  runnerRank,
  votingCountdown,
} from "../lib/runner.mjs";
test("runner warmup has no hazards and later rows always leave escape lanes", () => {
  for (let i = 0; i < 1000; i++) {
    assert.ok(runnerRow(4).every((item) => item.kind === "vote"));
    const row = runnerRow(100);
    assert.ok(row.every((item) => [-1, 0, 1].includes(item.lane)));
    assert.ok(
      row.filter((item) => item.kind === "quiz" || item.kind === "deadline")
        .length <= 1,
    );
    assert.equal(new Set(row.map((item) => item.lane)).size, row.length);
  }
});
test("chai only appears after the warmup", () => {
  const rolls = [0.5, 0.1, 0.05];
  const next = () => rolls.shift();
  assert.equal(runnerRow(4, () => 0.05)[0].kind, "vote");
  assert.equal(runnerRow(20, next)[0].kind, "chai");
});
test("jump clears quiz hurdles but cannot clear deadline walls", () => {
  assert.equal(runnerCollision("quiz", 0, 0, 0.4), "clear");
  assert.equal(runnerCollision("deadline", 0, 0, 0.4), "crash");
  assert.equal(runnerCollision("quiz", 0, 0, 0), "crash");
  assert.equal(runnerCollision("deadline", -1, 0, 0), "miss");
  assert.equal(runnerCollision("vote", 0, 0, 0.4), "collect");
  assert.equal(runnerCollision("chai", 0, 0, 0), "collect");
});
test("runner totals award 25 points per vote plus whole metres", () => {
  assert.equal(runnerScore(100.9, 4), 200);
  assert.equal(runnerScore(0, 0), 0);
});
test("rank titles climb with score", () => {
  assert.equal(runnerRank(0), "Fresher on day one");
  assert.equal(runnerRank(2600), "Vice President material");
});
test("voting countdown counts down, opens, then disappears", () => {
  const start = "2026-09-21T00:00:00+05:00",
    end = "2026-09-22T23:59:59+05:00";
  assert.equal(
    votingCountdown(Date.parse("2026-09-17T09:00:00+05:00"), start, end),
    "Voting in 4 days",
  );
  assert.equal(
    votingCountdown(Date.parse("2026-09-20T18:00:00+05:00"), start, end),
    "Voting starts tomorrow",
  );
  assert.equal(
    votingCountdown(Date.parse("2026-09-22T10:00:00+05:00"), start, end),
    "Voting is open now",
  );
  assert.equal(
    votingCountdown(Date.parse("2026-09-23T10:00:00+05:00"), start, end),
    null,
  );
});
