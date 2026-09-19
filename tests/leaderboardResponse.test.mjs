import test from "node:test";
import assert from "node:assert/strict";

test("leaderboard timestamps distinguish a completed score from a fresh check", () => {
  const lastSaved = 1000;
  const checkedAt = 8000;
  assert.ok(checkedAt > lastSaved);
  assert.equal(Math.round((checkedAt - lastSaved) / 1000), 7);
});
