import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBoardCache,
  buildBoard,
  mergeRow,
  withDeadline,
  BOARD_MEMORY_MS,
  BOARD_SNAPSHOT_MS,
  BOARD_LIMIT,
  DEPARTMENT_SNAPSHOT_MS,
} from "../lib/boardCache.mjs";

// A stand-in for Firestore that counts document reads, so the tests can show
// how much quota a board costs. `fail` makes every call reject, like the
// RESOURCE_EXHAUSTED error returned once the free daily quota runs out.
function fakeStore({ players = 60, fail = false, saved = null } = {}) {
  const store = {
    reads: 0,
    writes: 0,
    saved,
    fail,
    collection() {
      const query = {
        where: () => query,
        orderBy: () => query,
        limit: () => query,
        get: async () => {
          if (store.fail) throw Error("8 RESOURCE_EXHAUSTED: Quota exceeded.");
          store.reads += players;
          return {
            docs: Array.from({ length: players }, (_, i) => ({
              id: `p${i}`,
              data: () => ({
                nickname: `Player ${i}`,
                department: "CS",
                banned: false,
                bestScores: { dash: 10000 - i },
              }),
            })),
          };
        },
      };
      return query;
    },
    doc: () => ({
      get: async () => {
        if (store.fail) throw Error("8 RESOURCE_EXHAUSTED: Quota exceeded.");
        store.reads += 1;
        return { data: () => store.saved ?? undefined };
      },
      set: async (value) => {
        if (store.fail) throw Error("8 RESOURCE_EXHAUSTED: Quota exceeded.");
        store.writes += 1;
        store.saved = value;
      },
    }),
  };
  return store;
}

test("a board is built once, then served from the snapshot and memory", async () => {
  const store = fakeStore({ players: 60 });
  const cache = createBoardCache();
  const now = 1_000_000;

  const first = await cache.get(store, "dash", false, "dash", now);
  assert.equal(first.rows.length, Math.min(60, BOARD_LIMIT));
  assert.equal(first.rows[0].nickname, "Player 0");
  // One snapshot read that finds nothing, then one scan of the players.
  const buildCost = store.reads;
  assert.ok(buildCost > 50, "the first build scans the players collection");
  assert.equal(store.writes, 1, "the snapshot is saved for everyone else");

  // Polls inside the memory window cost nothing at all.
  for (let i = 0; i < 20; i++)
    await cache.get(store, "dash", false, "dash", now + i * 1000);
  assert.equal(store.reads, buildCost, "cached polls cost no reads");

  // A different server instance reads only the snapshot document: 1 read.
  const other = createBoardCache();
  await other.get(store, "dash", false, "dash", now + 50_000);
  assert.equal(store.reads, buildCost + 1, "a fresh instance costs one read");
});

test("the snapshot is rebuilt once it ages out", async () => {
  const store = fakeStore({ players: 60 });
  const cache = createBoardCache();
  const now = 2_000_000;
  await cache.get(store, "dash", false, "dash", now);
  const afterBuild = store.reads;

  await cache.get(store, "dash", false, "dash", now + BOARD_MEMORY_MS + 1);
  assert.equal(store.reads, afterBuild + 1, "still fresh: snapshot read only");

  await cache.get(store, "dash", false, "dash", now + BOARD_SNAPSHOT_MS + 1);
  assert.ok(store.reads > afterBuild + 2, "stale snapshot triggers a rebuild");
  assert.equal(store.writes, 2);
});

test("the departments board rebuilds sooner than the player boards", async () => {
  const store = fakeStore({ players: 10 });
  const cache = createBoardCache();
  const now = 5_000_000;
  await cache.get(store, "departments", true, "classic", now);
  const afterBuild = store.reads;
  // Half an hour on, the player boards are still fine but departments is not.
  const later = now + DEPARTMENT_SNAPSHOT_MS + 1;
  assert.ok(later - now < BOARD_SNAPSHOT_MS, "still fresh for player boards");
  await cache.get(store, "departments", true, "classic", later);
  assert.ok(store.reads > afterBuild + 1, "departments was rebuilt");
});

test("scores stay on screen when Firestore refuses reads", async () => {
  const store = fakeStore({ players: 60 });
  const cache = createBoardCache();
  const now = 3_000_000;
  const good = await cache.get(store, "dash", false, "dash", now);

  // Quota exhausted from here on.
  store.fail = true;
  const stale = await cache.get(
    store,
    "dash",
    false,
    "dash",
    now + BOARD_MEMORY_MS + 1,
  );
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.rows, good.rows, "the last known board is served");

  // A cold instance falls back to the saved snapshot document instead.
  const cold = createBoardCache();
  store.fail = false;
  const fromDoc = await cold.get(store, "dash", false, "dash", now + 10);
  assert.equal(fromDoc.rows.length, Math.min(60, BOARD_LIMIT));
});

test("a board with nothing to fall back on reports the failure", async () => {
  const store = fakeStore({ fail: true });
  const cache = createBoardCache();
  await assert.rejects(() => cache.get(store, "dash", false, "dash"), /Quota/);
});

test("zero scores and banned players are left off the board", async () => {
  const store = fakeStore({ players: 3 });
  store.collection = () => {
    const rows = [
      { id: "a", nickname: "Top", banned: false, bestScores: { dash: 900 } },
      { id: "b", nickname: "Banned", banned: true, bestScores: { dash: 999 } },
      { id: "c", nickname: "Never played", banned: false, bestScores: {} },
    ];
    const query = {
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      get: async () => ({
        docs: rows.map((r) => ({ id: r.id, data: () => r })),
      }),
    };
    return query;
  };
  const rows = await buildBoard(store, false, "dash");
  assert.deepEqual(
    rows.map((r) => r.nickname),
    ["Top"],
  );
});

test("a new score slots into the stored board without a rescan", () => {
  const rows = [
    { id: "a", nickname: "Ali", bestScore: 900 },
    { id: "b", nickname: "Sara", bestScore: 500 },
  ];
  const climbed = mergeRow(rows, {
    id: "b",
    nickname: "Sara",
    bestScore: 1200,
  });
  assert.deepEqual(
    climbed.map((r) => [r.nickname, r.bestScore]),
    [
      ["Sara", 1200],
      ["Ali", 900],
    ],
    "a player moves up instead of appearing twice",
  );

  const joined = mergeRow(rows, { id: "c", nickname: "New", bestScore: 700 });
  assert.deepEqual(
    joined.map((r) => r.nickname),
    ["Ali", "New", "Sara"],
  );

  // A board never grows past the published length.
  const many = Array.from({ length: BOARD_LIMIT }, (_, i) => ({
    id: `x${i}`,
    bestScore: 10000 - i,
  }));
  assert.equal(
    mergeRow(many, { id: "last", bestScore: 1 }).length,
    BOARD_LIMIT,
  );
  assert.ok(
    !mergeRow(many, { id: "last", bestScore: 1 }).some((r) => r.id === "last"),
    "a score below the board does not displace anyone",
  );
  assert.deepEqual(mergeRow(rows, { id: "z", bestScore: 0 }), rows);
});

test("a hung Firestore call gives up quickly", async () => {
  const started = Date.now();
  await assert.rejects(
    () => withDeadline(new Promise(() => {}), 30),
    /timed out/,
  );
  assert.ok(Date.now() - started < 1000);
  // A call that answers in time keeps its value.
  assert.equal(await withDeadline(Promise.resolve("ok"), 1000), "ok");
});
