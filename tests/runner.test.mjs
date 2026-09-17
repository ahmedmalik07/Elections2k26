import test from "node:test";
import assert from "node:assert/strict";
import {
  achievements,
  approachSpeed,
  busLane,
  BUS_BOOST,
  collabRow,
  earnedAchievements,
  isPickup,
  multiplier,
  runnerCollision,
  runnerRank,
  runnerRow,
  runnerScore,
  spawnGap,
  votePoints,
  votingCountdown,
  zoneAt,
  zones,
  ZONE_LENGTH,
} from "../lib/runner.mjs";

test("warmup rows are only votes", () => {
  for (let i = 0; i < 500; i++)
    assert.ok(runnerRow(3).every((item) => item.kind === "vote"));
});

// Plays the spawner forward and checks every moment rows reach the player:
// at least one lane must be passable with a single action (or none).
test("every generated moment leaves the player a way through", () => {
  for (let run = 0; run < 40; run++) {
    let items = [],
      time = 0,
      spawn = 1,
      arrivals = [];
    const dt = 1 / 60;
    while (time < 180) {
      time += dt;
      spawn -= dt;
      const a = approachSpeed(time);
      if (spawn <= 0) {
        const zone = zones[Math.floor(time / 25) % zones.length];
        items.push(...runnerRow(time, zone, Math.random, items));
        spawn = spawnGap(time);
      }
      for (const item of items) {
        const before = item.z;
        item.z += dt * (a + (item.kind === "bus" ? BUS_BOOST : 0));
        if (before < 0.88 && item.z >= 0.88 && !isPickup(item.kind))
          arrivals.push({ time, lane: item.lane, kind: item.kind });
      }
      items = items.filter((i) => i.z < 1);
    }
    for (const hit of arrivals) {
      const together = arrivals.filter(
        (o) => Math.abs(o.time - hit.time) < 0.12,
      );
      const passable = [-1, 0, 1].some((lane) => {
        const kinds = new Set(
          together.filter((o) => o.lane === lane).map((o) => o.kind),
        );
        if (kinds.size === 0) return true;
        return kinds.size === 1 && (kinds.has("quiz") || kinds.has("bar"));
      });
      assert.ok(
        passable,
        `blocked at ${hit.time.toFixed(2)}s: ${JSON.stringify(together)}`,
      );
    }
  }
});

test("buses only share arrival time with lanes that are already blocked", () => {
  const time = 60,
    a = approachSpeed(time),
    meet = (0.88 * BUS_BOOST) / (a + BUS_BOOST);
  const items = [
    { lane: -1, kind: "deadline", z: meet },
    { lane: 0, kind: "quiz", z: meet },
    { lane: 1, kind: "vote", z: meet },
  ];
  for (let i = 0; i < 200; i++) assert.notEqual(busLane(time, items), 1);
});

test("jump clears hurdles, slide clears bars, wings clear everything", () => {
  assert.equal(runnerCollision("quiz", 0, 0, { jump: 0.4 }), "clear");
  assert.equal(runnerCollision("quiz", 0, 0, { slide: 0.4 }), "crash");
  assert.equal(runnerCollision("bar", 0, 0, { slide: 0.4 }), "clear");
  assert.equal(runnerCollision("bar", 0, 0, { jump: 0.4 }), "crash");
  assert.equal(runnerCollision("deadline", 0, 0, { jump: 0.4 }), "crash");
  assert.equal(runnerCollision("bus", 0, 0, { fly: 2 }), "clear");
  assert.equal(runnerCollision("deadline", -1, 0, {}), "miss");
  assert.equal(runnerCollision("collab", 0, 0, {}), "collect");
});

test("the GDG magnet pulls votes from every lane", () => {
  assert.equal(runnerCollision("vote", 1, -1, {}), "miss");
  assert.equal(runnerCollision("vote", 1, -1, { magnet: 3 }), "collect");
  assert.equal(runnerCollision("chai", 1, -1, { magnet: 3 }), "miss");
});

test("vote chains raise the multiplier to x5 and the trophy doubles it", () => {
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(8), 2);
  assert.equal(multiplier(100), 5);
  assert.equal(votePoints(40, true), 250);
  assert.equal(runnerScore(100.9, 250), 350);
});

test("campuses change every zone and loop after the hackathon hall", () => {
  assert.equal(zoneAt(0).id, "e9");
  assert.equal(zoneAt(ZONE_LENGTH * 3 + 1).id, "fmc");
  assert.equal(zoneAt(ZONE_LENGTH * zones.length).id, "e9");
  assert.equal(collabRow(1)[0].label, "FAST");
});

test("achievements unlock from run stats", () => {
  const run = {
    distance: ZONE_LENGTH * 4 + 10,
    votes: 130,
    chai: 3,
    flights: 2,
    slides: 9,
    collabs: 4,
    maxChain: 40,
    score: 16000,
  };
  const earned = earnedAchievements(run, { runs: 20 });
  assert.equal(
    new Set(achievements.map((a) => a.id)).size,
    achievements.length,
  );
  for (const id of [
    "kamra",
    "fmc",
    "ninja",
    "chai",
    "pilot",
    "collab",
    "votes",
    "fire",
    "vp",
    "volunteer",
  ])
    assert.ok(earned.includes(id), id);
  assert.ok(!earned.includes("multan"));
});

test("rank titles climb with score", () => {
  assert.equal(runnerRank(0), "Fresher on day one");
  assert.equal(runnerRank(16000), "Vice President material");
});

test("voting countdown counts down, opens, then disappears", () => {
  const start = "2026-09-21T00:00:00+05:00",
    end = "2026-09-22T23:59:59+05:00";
  const at = (iso) => votingCountdown(Date.parse(iso), start, end);
  assert.equal(at("2026-09-17T09:00:00+05:00"), "Voting in 4 days");
  assert.equal(at("2026-09-20T18:00:00+05:00"), "Voting starts tomorrow");
  assert.equal(at("2026-09-22T10:00:00+05:00"), "Voting is open now");
  assert.equal(at("2026-09-23T10:00:00+05:00"), null);
});
