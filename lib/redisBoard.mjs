// Leaderboards served from Upstash Redis, so the boards keep working even when
// Firestore's free daily quota runs out.
//
// Firestore stays the permanent record of every player and score. Redis only
// holds what a board needs to be drawn: one sorted set of scores per game, plus
// a hash of nicknames. A board read costs 2 Redis commands, a saved score 2.
// On Upstash's free plan (500k commands a month, no card) that is far more than
// this campaign can use.
//
// With no credentials set, every function here returns null and the callers
// fall back to Firestore, so the site runs unchanged without Upstash.
const url = () => process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN;
export const redisReady = () => !!(url() && token());

export const boardKey = (mode) => `board:${mode}`;
export const namesKey = () => "board:names";

// Upstash speaks Redis over HTTPS: an array of commands, an array of results.
export async function redisPipeline(commands, { timeoutMs = 4000 } = {}) {
  if (!redisReady() || commands.length === 0) return null;
  const res = await fetch(`${url()}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands.map((c) => c.map(String))),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw Error(`Upstash replied ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body)) throw Error("Upstash returned an unexpected body.");
  const failed = body.find((r) => r && r.error);
  if (failed) throw Error(String(failed.error));
  return body.map((r) => (r ? r.result : null));
}

// ZREVRANGE gives the top scores in order; the names hash turns ids into rows.
export async function redisBoard(mode, limit = 50) {
  const [ranked] = (await redisPipeline([
    ["ZREVRANGE", boardKey(mode), 0, limit - 1, "WITHSCORES"],
  ])) || [null];
  if (!ranked || ranked.length === 0) return null;
  const ids = [];
  const scores = [];
  for (let i = 0; i < ranked.length; i += 2) {
    ids.push(ranked[i]);
    scores.push(Number(ranked[i + 1]));
  }
  const [names] = await redisPipeline([["HMGET", namesKey(), ...ids]]);
  return ids.map((id, i) => {
    let meta = {};
    try {
      meta = names?.[i] ? JSON.parse(names[i]) : {};
    } catch {
      meta = {};
    }
    return {
      id,
      nickname: meta.nickname || "Player",
      department: meta.department,
      cardsCollected: meta.cardsCollected,
      bestScore: scores[i],
    };
  });
}

// GT keeps a player's best score: a worse run never lowers what is on the board.
export async function redisSaveScore(mode, row) {
  if (!redisReady()) return null;
  return redisPipeline([
    ["ZADD", boardKey(mode), "GT", "CH", row.bestScore, row.id],
    [
      "HSET",
      namesKey(),
      row.id,
      JSON.stringify({
        nickname: row.nickname,
        department: row.department,
        cardsCollected: row.cardsCollected,
      }),
    ],
  ]);
}

// Used after a rebuild from Firestore, and by scripts/syncRedis.mjs.
export async function redisReplaceBoard(mode, rows) {
  if (!redisReady()) return null;
  const commands = [["DEL", boardKey(mode)]];
  if (rows.length) {
    commands.push([
      "ZADD",
      boardKey(mode),
      ...rows.flatMap((r) => [r.bestScore || 0, r.id]),
    ]);
    commands.push([
      "HSET",
      namesKey(),
      ...rows.flatMap((r) => [
        r.id,
        JSON.stringify({
          nickname: r.nickname,
          department: r.department,
          cardsCollected: r.cardsCollected,
        }),
      ]),
    ]);
  }
  return redisPipeline(commands, { timeoutMs: 15000 });
}

// A player who has dropped off the board entirely (banned, score deleted).
export async function redisForget(mode, id) {
  if (!redisReady()) return null;
  return redisPipeline([["ZREM", boardKey(mode), id]]);
}
