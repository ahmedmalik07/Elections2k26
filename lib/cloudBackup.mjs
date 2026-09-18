// Backups of every player, score and leaderboard, kept outside Firestore.
//
// A daily Vercel cron calls /api/backup/daily, which stores a copy in Upstash
// Redis for 30 days, so a backup exists even when the laptop is off. The same
// builder feeds `npm run backup`, which writes a local file.
import { redisPipeline, redisReady } from "./redisBoard.mjs";

export const BOARD_MODES = ["dash", "easy", "chai", "memory", "classic"];
export const BACKUP_DAYS = 30;
// Upstash's free plan refuses requests over 1 MB. Past this size the raw score
// history is left out of the cloud copy; every player's best scores remain.
export const MAX_CLOUD_BYTES = 900_000;
// However often the endpoint is called, at most one backup per 20 hours runs,
// so nobody can spend the read quota by calling it repeatedly.
export const BACKUP_GAP_SECONDS = 20 * 60 * 60;

const bestFor = (player, mode) =>
  mode === "classic" ? player.bestScore || 0 : player.bestScores?.[mode] || 0;

export function leaderboardsFrom(players) {
  return Object.fromEntries(
    BOARD_MODES.map((mode) => [
      mode,
      players
        .filter((p) => !p.banned && bestFor(p, mode) > 0)
        .sort((a, b) => bestFor(b, mode) - bestFor(a, mode))
        .slice(0, 50)
        .map((p, i) => ({
          rank: i + 1,
          id: p.id,
          nickname: p.nickname,
          department: p.department,
          score: bestFor(p, mode),
        })),
    ]),
  );
}

export async function buildBackup(store, now = new Date()) {
  const dump = async (name) =>
    (await store.collection(name).get()).docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  const [players, scores, departments, stats] = await Promise.all([
    dump("players"),
    dump("scores"),
    dump("departments"),
    dump("stats"),
  ]);
  return {
    takenAt: now.toISOString(),
    players,
    scores,
    departments,
    stats,
    leaderboards: leaderboardsFrom(players),
  };
}

// Trims the score history if needed so the copy fits in one Upstash request.
export function forCloud(backup) {
  let body = JSON.stringify(backup);
  if (body.length <= MAX_CLOUD_BYTES) return { body, trimmed: false };
  body = JSON.stringify({ ...backup, scores: [], scoresOmitted: true });
  return { body, trimmed: true };
}

export async function saveCloudBackup(backup) {
  if (!redisReady()) return null;
  const day = backup.takenAt.slice(0, 10);
  const { body, trimmed } = forCloud(backup);
  await redisPipeline(
    [
      ["SET", `backup:${day}`, body, "EX", BACKUP_DAYS * 86400],
      ["SET", "backup:latest", day],
    ],
    { timeoutMs: 15000 },
  );
  return { day, bytes: body.length, trimmed };
}

// Claims today's backup slot. Returns false if one ran in the last 20 hours.
export async function claimBackupSlot() {
  if (!redisReady()) return false;
  const [claimed] = await redisPipeline([
    ["SET", "backup:lock", Date.now(), "NX", "EX", BACKUP_GAP_SECONDS],
  ]);
  return claimed === "OK";
}

export async function latestCloudBackup() {
  if (!redisReady()) return null;
  const [day] = await redisPipeline([["GET", "backup:latest"]]);
  if (!day) return null;
  const [body] = await redisPipeline([["GET", `backup:${day}`]], {
    timeoutMs: 15000,
  });
  return body ? { day, body } : null;
}

export async function listCloudBackups() {
  if (!redisReady()) return [];
  const [keys] = await redisPipeline([["KEYS", "backup:20*"]]);
  return (keys || [])
    .map((k) => k.slice("backup:".length))
    .sort()
    .reverse();
}
