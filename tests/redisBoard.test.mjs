import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  redisReady,
  redisBoard,
  redisSaveScore,
  redisReplaceBoard,
  redisForget,
} from "../lib/redisBoard.mjs";
import { createBoardCache } from "../lib/boardCache.mjs";

// A stand-in for Upstash: enough of Redis to run the leaderboard, so these
// tests need no network and no account.
function fakeUpstash() {
  const zsets = new Map(); // key -> Map(member -> score)
  const hashes = new Map(); // key -> Map(field -> value)
  const state = { calls: 0, commands: 0, fail: false, bodies: [] };
  const run = ([name, key, ...args]) => {
    const verb = name.toUpperCase();
    if (verb === "DEL") return (zsets.delete(key), 1);
    if (verb === "ZADD") {
      const set = zsets.get(key) || new Map();
      zsets.set(key, set);
      const flags = [];
      while (["GT", "CH", "NX", "XX"].includes(String(args[0]).toUpperCase()))
        flags.push(String(args.shift()).toUpperCase());
      for (let i = 0; i < args.length; i += 2) {
        const score = Number(args[i]);
        const member = args[i + 1];
        const old = set.get(member);
        if (flags.includes("GT") && old !== undefined && old >= score) continue;
        set.set(member, score);
      }
      return set.size;
    }
    if (verb === "ZREVRANGE") {
      const set = zsets.get(key) || new Map();
      const [start, stop] = [Number(args[0]), Number(args[1])];
      const sorted = [...set.entries()].sort((a, b) => b[1] - a[1]);
      const end = stop < 0 ? sorted.length + stop : stop;
      return sorted
        .slice(start, end + 1)
        .flatMap(([member, score]) => [member, String(score)]);
    }
    if (verb === "ZREM") {
      const set = zsets.get(key);
      return set?.delete(args[0]) ? 1 : 0;
    }
    if (verb === "HSET") {
      const hash = hashes.get(key) || new Map();
      hashes.set(key, hash);
      for (let i = 0; i < args.length; i += 2) hash.set(args[i], args[i + 1]);
      return args.length / 2;
    }
    if (verb === "HMGET") {
      const hash = hashes.get(key) || new Map();
      return args.map((field) => hash.get(field) ?? null);
    }
    throw Error(`fake Upstash got an unknown command: ${verb}`);
  };
  return {
    state,
    fetch: async (url, options) => {
      state.calls += 1;
      if (state.fail) return { ok: false, status: 500, json: async () => ({}) };
      assert.match(String(url), /\/pipeline$/);
      assert.equal(options.headers.Authorization, "Bearer test-token");
      const commands = JSON.parse(options.body);
      state.commands += commands.length;
      state.bodies.push(commands);
      return {
        ok: true,
        status: 200,
        json: async () => commands.map((c) => ({ result: run([...c]) })),
      };
    },
  };
}

let realFetch;
let upstash;
beforeEach(() => {
  realFetch = globalThis.fetch;
  upstash = fakeUpstash();
  globalThis.fetch = upstash.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test("without credentials nothing touches Redis", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(redisReady(), false);
  assert.equal(await redisBoard("dash"), null);
  assert.equal(await redisSaveScore("dash", { id: "a", bestScore: 5 }), null);
  assert.equal(upstash.state.calls, 0);
});

test("a saved score appears on the board, best score first", async () => {
  await redisSaveScore("dash", {
    id: "a",
    nickname: "Ali",
    department: "CS",
    bestScore: 900,
  });
  await redisSaveScore("dash", {
    id: "b",
    nickname: "Sara",
    department: "EE",
    bestScore: 1500,
  });
  const rows = await redisBoard("dash", 10);
  assert.deepEqual(
    rows.map((r) => [r.nickname, r.bestScore, r.department]),
    [
      ["Sara", 1500, "EE"],
      ["Ali", 900, "CS"],
    ],
  );
});

test("a worse run never lowers a player's place", async () => {
  await redisSaveScore("dash", { id: "a", nickname: "Ali", bestScore: 900 });
  await redisSaveScore("dash", { id: "a", nickname: "Ali", bestScore: 300 });
  const rows = await redisBoard("dash", 10);
  assert.deepEqual(rows, [
    {
      id: "a",
      nickname: "Ali",
      department: undefined,
      cardsCollected: undefined,
      bestScore: 900,
    },
  ]);
});

test("reading a board costs two commands, saving a score costs two", async () => {
  await redisSaveScore("dash", { id: "a", nickname: "Ali", bestScore: 900 });
  const afterSave = upstash.state.commands;
  assert.equal(afterSave, 2, "one ZADD and one HSET");
  await redisBoard("dash", 50);
  assert.equal(
    upstash.state.commands - afterSave,
    2,
    "one ZREVRANGE and one HMGET",
  );
});

test("a rebuilt board replaces what Redis had", async () => {
  await redisSaveScore("dash", { id: "old", nickname: "Gone", bestScore: 50 });
  await redisReplaceBoard("dash", [
    { id: "x", nickname: "New", bestScore: 10 },
  ]);
  const rows = await redisBoard("dash", 10);
  assert.deepEqual(
    rows.map((r) => r.nickname),
    ["New"],
  );
  await redisForget("dash", "x");
  assert.equal(
    await redisBoard("dash", 10),
    null,
    "an empty board is no board",
  );
});

test("the boards fall back to Firestore when Upstash is unreachable", async () => {
  upstash.state.fail = true;
  const firestore = {
    reads: 0,
    collection() {
      const query = {
        where: () => query,
        orderBy: () => query,
        limit: () => query,
        get: async () => ({
          docs: [
            {
              id: "a",
              data: () => ({
                nickname: "Ali",
                banned: false,
                bestScores: { dash: 700 },
              }),
            },
          ],
        }),
      };
      return query;
    },
    doc: () => ({
      get: async () => ({ data: () => undefined }),
      set: async () => {},
    }),
  };
  const cache = createBoardCache({
    redis: {
      ready: redisReady,
      board: redisBoard,
      replace: redisReplaceBoard,
    },
  });
  const snap = await cache.get(firestore, "dash", false, "dash");
  assert.deepEqual(
    snap.rows.map((r) => r.nickname),
    ["Ali"],
    "Firestore still draws the board when Redis is down",
  );
});

test("Redis is preferred over Firestore when it has the board", async () => {
  await redisSaveScore("dash", {
    id: "a",
    nickname: "FromRedis",
    bestScore: 5,
  });
  const firestore = {
    doc: () => ({
      get: async () => assert.fail("Firestore should not have been read"),
      set: async () => {},
    }),
    collection: () => assert.fail("Firestore should not have been scanned"),
  };
  const cache = createBoardCache({
    redis: {
      ready: redisReady,
      board: redisBoard,
      replace: redisReplaceBoard,
    },
  });
  const snap = await cache.get(firestore, "dash", false, "dash");
  assert.equal(snap.source, "redis");
  assert.equal(snap.rows[0].nickname, "FromRedis");
});
