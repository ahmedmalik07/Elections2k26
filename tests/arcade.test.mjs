import { test } from "node:test";
import assert from "node:assert/strict";
import {
  games,
  memoryScore,
  earnedCards,
  shufflePairs,
} from "../lib/arcade.mjs";
import { validateScore, validatedCards } from "../lib/validation.mjs";
const base = {
  score: 0,
  woken: 0,
  pops: 0,
  maxCombo: 0,
  powerupsUsed: 0,
  durationMs: 30000,
  earlyEnd: false,
  hits: 0,
  pairs: 0,
  mistakes: 0,
};
test("all arcade games have unique persistent identities", () =>
  assert.equal(new Set(games.map((g) => g.id)).size, 4));
test("memory decks contain exactly six pairs even after shuffling", () => {
  for (let i = 0; i < 50; i++) {
    const deck = shufflePairs();
    assert.equal(deck.length, 12);
    for (let v = 0; v < 6; v++)
      assert.equal(deck.filter((n) => n === v).length, 2);
  }
});
test("memory scoring rewards completion and fewer mistakes, never negative", () => {
  assert.equal(memoryScore(6, 0), 420);
  assert.equal(memoryScore(6, 3), 390);
  assert.equal(memoryScore(6, 50), 300);
  assert.equal(memoryScore(3, 10), 150);
});
test("chai results must match taps, duration and session game", () => {
  const b = { ...base, mode: "chai", hits: 20, score: 200 };
  assert.equal(validateScore(b, 34000, "chai"), true);
  for (const patch of [
    { score: 999 },
    { durationMs: 1000 },
    { hits: 301 },
    { woken: 1 },
    { pairs: 1 },
    { earlyEnd: true },
  ])
    assert.throws(() => validateScore({ ...b, ...patch }, 34000, "chai"));
  assert.throws(() => validateScore(b, 34000, "memory"));
  assert.throws(() => validateScore(b, 500, "chai"));
});
test("memory accepts completed or timed-out rounds and rejects fabricated scores", () => {
  const b = {
    ...base,
    mode: "memory",
    pairs: 6,
    mistakes: 2,
    score: 400,
    durationMs: 12000,
  };
  assert.equal(validateScore(b, 15500, "memory"), true);
  assert.equal(
    validateScore(
      { ...b, pairs: 3, score: 150, durationMs: 90000 },
      94000,
      "memory",
    ),
    true,
  );
  assert.throws(() =>
    validateScore({ ...b, pairs: 3, score: 150 }, 15500, "memory"),
  );
  assert.throws(() => validateScore({ ...b, score: 420 }, 15500, "memory"));
  assert.throws(() => validateScore({ ...b, pairs: 7 }, 15500, "memory"));
});
test("server derives mini-game card rewards from validated performance", () => {
  assert.deepEqual(earnedCards("chai", 0), []);
  assert.deepEqual(
    validatedCards({ ...base, hits: 1, cards: ["trophy"] }, "chai"),
    ["chai"],
  );
  assert.equal(validatedCards({ ...base, pairs: 4 }, "memory").length, 4);
});
