import test from "node:test";
import assert from "node:assert/strict";
import { runnerScore, runnerCollision, runnerRow } from "../lib/runner.mjs";
test("runner warmup has no hazards and later rows always leave escape lanes", () => {
  for (let i = 0; i < 1000; i++) {
    assert.ok(runnerRow(4).every(item => item.kind === "coin"));
    const row = runnerRow(100);
    assert.ok(row.every(item => [-1, 0, 1].includes(item.lane)));
    assert.ok(row.filter(item => item.kind !== "coin").length <= 1);
    assert.equal(new Set(row.map(item => item.lane)).size, row.length);
  }
});
test("jump clears low barriers but cannot clear tall blocks", () => {
  assert.equal(runnerCollision("barrier", 0, 0, 0.4), "clear");
  assert.equal(runnerCollision("block", 0, 0, 0.4), "crash");
  assert.equal(runnerCollision("barrier", 0, 0, 0), "crash");
  assert.equal(runnerCollision("block", -1, 0, 0), "miss");
  assert.equal(runnerCollision("coin", 0, 0, 0.4), "collect");
});
test("runner totals award 25 points per token plus whole metres", () => {
  assert.equal(runnerScore(100.9, 4), 200);
  assert.equal(runnerScore(0, 0), 0);
});
