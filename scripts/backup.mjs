// Saves a copy of every player, score and leaderboard to a local JSON file, so
// the results survive a Firebase problem, a wrong delete or a quota block.
//   npm run backup
// Reads the same FIREBASE_* variables as the site, from .env.local.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = process.cwd();
const outDir = join(root, "backups");

function loadEnv() {
  if (process.env.FIREBASE_PROJECT_ID) return;
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split(
      /\r?\n/,
    )) {
      const match = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // No .env.local: fall through to the check below.
  }
}

loadEnv();
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.error(
    "No Firebase credentials found. Put them in .env.local, or run\n" +
      '  npm run setup -- "path/to/service-account.json" "https://your-domain"',
  );
  process.exit(1);
}
if (!getApps().length)
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
const store = getFirestore();

const dump = async (name) => {
  const snap = await store.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const backup = {
  takenAt: new Date().toISOString(),
  project: process.env.FIREBASE_PROJECT_ID,
  players: await dump("players"),
  scores: await dump("scores"),
  departments: await dump("departments"),
  stats: await dump("stats"),
};

const rank = (player, mode) =>
  mode === "classic" ? player.bestScore || 0 : player.bestScores?.[mode] || 0;
backup.leaderboards = Object.fromEntries(
  ["dash", "easy", "chai", "memory", "classic"].map((mode) => [
    mode,
    backup.players
      .filter((p) => !p.banned && rank(p, mode) > 0)
      .sort((a, b) => rank(b, mode) - rank(a, mode))
      .slice(0, 50)
      .map((p, i) => ({
        rank: i + 1,
        nickname: p.nickname,
        department: p.department,
        score: rank(p, mode),
      })),
  ]),
);

mkdirSync(outDir, { recursive: true });
const stamp = backup.takenAt.replace(/[:.]/g, "-").slice(0, 19);
const file = join(outDir, `backup-${stamp}.json`);
writeFileSync(file, JSON.stringify(backup, null, 2));

// A readable copy of the winners, for picking who gets the cookies.
const winners = Object.entries(backup.leaderboards)
  .map(
    ([mode, rows]) =>
      `${mode.toUpperCase()}\n` +
      (rows.length
        ? rows
            .slice(0, 10)
            .map(
              (r) =>
                `${String(r.rank).padStart(2)}. ${r.nickname} — ${r.score.toLocaleString()}${r.department ? ` (${r.department})` : ""}`,
            )
            .join("\n")
        : "  no scores yet"),
  )
  .join("\n\n");
writeFileSync(
  join(outDir, `top-players-${stamp}.txt`),
  `Jaago Campus leaderboards\nTaken ${backup.takenAt}\n\n${winners}\n`,
);

console.log(
  `Saved ${backup.players.length} players and ${backup.scores.length} scores to\n  ${file}\n` +
    `Top players also written to backups/top-players-${stamp}.txt\n` +
    `${readdirSync(outDir).length} files in backups/ (never committed to git).`,
);
