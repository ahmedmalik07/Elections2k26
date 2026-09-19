import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueScore,
  acknowledgeScore,
  nextPendingScore,
} from "../lib/pendingScores.mjs";
test("a replay and reload preserve complete signed failed submissions", () => {
  let queue = enqueueScore([], {
    token: "first",
    score: 900000,
    durationMs: 3600000,
    points: 850000,
  });
  queue = enqueueScore(queue, { token: "second", score: 100 });
  queue = JSON.parse(JSON.stringify(queue));
  assert.equal(nextPendingScore(queue).score, 900000);
  queue = acknowledgeScore(queue, "second");
  assert.equal(queue.length, 1);
  assert.equal(queue[0].token, "first");
  assert.equal(queue[0].durationMs, 3600000);
  assert.deepEqual(acknowledgeScore(queue, "first"), []);
});
test("retries deduplicate by token, not by score or nickname", () => {
  const body = { token: "same", score: 900 };
  const queue = enqueueScore(enqueueScore([], body), body);
  assert.equal(queue.length, 1);
  assert.equal(acknowledgeScore(queue, "another").length, 1);
});
