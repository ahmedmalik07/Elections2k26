import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as validation from "../lib/validation.mjs";
import * as cache from "../lib/boardCache.mjs";
import * as arcade from "../lib/arcade.mjs";

// Exercise the actual route handler with isolated storage, never production data.
function handler({ rankFails = false, redisFails = false } = {}) {
  const docs = new Map([
    [
      "players/p1",
      {
        nickname: "Tester",
        department: "CS",
        banned: false,
        bestScore: 0,
        bestScores: {},
        totalWoken: 0,
        plays: 0,
      },
    ],
    ["stats/global", { totalPlays: 0, totalWoken: 0 }],
  ]);
  const ref = (path) => ({
    path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
  });
  const store = {
    doc: ref,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (work) => {
      const writes = [];
      await work({
        get: (r) => r.get(),
        set: (r, d) => writes.push(() => docs.set(r.path, d)),
        update: (r, d) =>
          writes.push(() => docs.set(r.path, { ...docs.get(r.path), ...d })),
      });
      writes.forEach((w) => w());
    },
  };
  const count = () => ({
    count: () => ({
      get: async () => {
        if (rankFails) throw Error("rank outage");
        return { data: () => ({ count: 0 }) };
      },
    }),
  });
  const modules = {
    "next/server": {
      NextResponse: {
        json: (data, options) => ({ data, status: options?.status || 200 }),
      },
    },
    "next/headers": {},
    "node:crypto": crypto,
    "@/lib/server": {
      db: () => store,
      owner: async () => "p1",
      verify: () => ({
        kind: "round",
        playerId: "p1",
        tokenId: "round1",
        mode: "dash",
        startedAt: Date.now() - 3601000,
      }),
    },
    "@/lib/validation.mjs": validation,
    "@/lib/arcade.mjs": arcade,
    "@/lib/boardCache.mjs": {
      ...cache,
      playersBy: () => ({ above: count, ranked: count }),
    },
    "@/lib/redisBoard.mjs": {
      redisReady: () => true,
      redisSaveScore: async () => {
        if (redisFails) throw Error("redis outage");
      },
    },
    "@/lib/cloudBackup.mjs": {},
    "@/config/campaign": { campaign: {} },
  };
  const source = readFileSync(
    new URL("../app/api/[...path]/route.ts", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!(name in modules)) throw Error(name);
      return modules[name];
    },
    Date,
    Buffer,
    setTimeout,
    clearTimeout,
    process,
  });
  return {
    docs,
    post: (body) =>
      exports.POST(
        { method: "POST", headers: new Headers(), json: async () => body },
        { params: Promise.resolve({ path: ["score"] }) },
      ),
  };
}
const run = {
  token: "signed",
  mode: "dash",
  score: 890000,
  durationMs: 3600000,
  distance: 140000,
  votes: 6000,
  points: 750000,
  collabs: 30,
};
test("retry after a lost response acknowledges exactly one committed score", async () => {
  const { docs, post } = handler();
  assert.equal((await post(run)).data.saved, true);
  assert.equal((await post(run)).data.saved, true);
  assert.equal(docs.get("stats/global").totalPlays, 1);
  assert.equal(docs.get("players/p1").plays, 1);
  assert.equal(
    [...docs.keys()].filter((k) => k.startsWith("scores/")).length,
    1,
  );
  assert.equal(
    (await post({ ...run, score: 891000, points: 751000 })).status,
    400,
  );
});
test("Redis and rank failures do not report a committed run as unsaved", async () => {
  const { docs, post } = handler({ rankFails: true, redisFails: true });
  const result = await post(run);
  assert.equal(result.status, 200);
  assert.equal(result.data.saved, true);
  assert.equal(result.data.rank, null);
  assert.equal(docs.get("players/p1").bestScores.dash, 890000);
});
