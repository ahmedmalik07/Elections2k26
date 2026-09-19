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

// The queue always uploads the highest score first. If the server refuses one
// outright (a 4xx verdict that retrying can never change), leaving it in place
// would starve every later run that player earns, because it outranks them all.
test("a refused run is dropped so it cannot block this player's later scores", () => {
  let queue = enqueueScore([], { token: "refused", score: 5000000 });
  queue = enqueueScore(queue, { token: "good", score: 120000 });
  assert.equal(
    nextPendingScore(queue).token,
    "refused",
    "the highest queued run is tried first",
  );
  // The server answers 4xx: drop it rather than retrying it forever.
  queue = acknowledgeScore(queue, "refused");
  assert.equal(
    nextPendingScore(queue).token,
    "good",
    "the next honest run is now free to upload",
  );
  assert.equal(queue.length, 1);
  assert.equal(nextPendingScore(acknowledgeScore(queue, "good")), null);
});
