import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBackup,
  forCloud,
  leaderboardsFrom,
  MAX_CLOUD_BYTES,
} from "../lib/cloudBackup.mjs";

const players = [
  { id: "a", nickname: "Akif", bestScore: 0, bestScores: { dash: 900 } },
  { id: "b", nickname: "Sara", bestScore: 1900, bestScores: { dash: 1200 } },
  {
    id: "c",
    nickname: "Banned",
    banned: true,
    bestScore: 0,
    bestScores: { dash: 5000 },
  },
  { id: "d", nickname: "Idle", bestScore: 0, bestScores: {} },
];

test("the backup ranks every game, skipping bans and zero scores", () => {
  const boards = leaderboardsFrom(players);
  assert.deepEqual(
    boards.dash.map((r) => [r.rank, r.nickname, r.score]),
    [
      [1, "Sara", 1200],
      [2, "Akif", 900],
    ],
  );
  assert.deepEqual(
    boards.classic.map((r) => r.nickname),
    ["Sara"],
  );
  assert.deepEqual(boards.chai, []);
});

test("the backup copies every collection it needs", async () => {
  const data = {
    players,
    scores: [{ id: "s1", playerId: "a", score: 900 }],
    departments: [{ id: "CS", totalWoken: 3 }],
    stats: [{ id: "global", totalPlays: 7 }],
  };
  const store = {
    collection: (name) => ({
      get: async () => ({
        docs: data[name].map(({ id, ...rest }) => ({ id, data: () => rest })),
      }),
    }),
  };
  const backup = await buildBackup(store, new Date("2026-09-18T21:00:00Z"));
  assert.equal(backup.takenAt, "2026-09-18T21:00:00.000Z");
  assert.equal(backup.players.length, 4);
  assert.equal(backup.scores[0].score, 900);
  assert.equal(backup.stats[0].totalPlays, 7);
  assert.equal(backup.leaderboards.dash[0].nickname, "Sara");
});

test("a backup too big for one Upstash request drops only the score history", () => {
  const small = { players, scores: [{ id: "s", score: 1 }] };
  assert.equal(forCloud(small).trimmed, false);

  const huge = {
    players,
    scores: Array.from({ length: 20000 }, (_, i) => ({
      id: `score-${i}`,
      playerId: "a",
      score: i,
      note: "x".repeat(40),
    })),
  };
  const cloud = forCloud(huge);
  assert.equal(cloud.trimmed, true);
  assert.ok(cloud.body.length <= MAX_CLOUD_BYTES);
  const kept = JSON.parse(cloud.body);
  assert.equal(kept.players.length, 4, "every player and best score is kept");
  assert.equal(kept.scoresOmitted, true);
});
