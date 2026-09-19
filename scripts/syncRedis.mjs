// Copies the leaderboards from Firestore into Upstash Redis.
//   npm run sync:redis
// Run this once after adding the Upstash credentials, and any time you want to
// force the Redis boards to match Firestore exactly. Firestore stays the record
// of every player and score; Redis only holds what a board needs to be drawn.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildBoard } from "../lib/boardCache.mjs";
import {
  redisReady,
  redisReplaceBoard,
  redisBoard,
} from "../lib/redisBoard.mjs";

const root = process.cwd();
for (const line of (() => {
  try {
    return readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
})()) {
  const match = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (match && !process.env[match[1]])
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

if (!redisReady()) {
  console.error(
    "No Upstash credentials found. Add these to .env.local and to Vercel:\n" +
      "  UPSTASH_REDIS_REST_URL=https://....upstash.io\n" +
      "  UPSTASH_REDIS_REST_TOKEN=...\n" +
      "Both are on the Upstash console page for your database, under REST API.",
  );
  process.exit(1);
}
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error("No Firebase credentials found in .env.local.");
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

for (const mode of ["dash", "easy", "chai", "memory", "classic"]) {
  try {
    const rows = await buildBoard(store, false, mode);
    await redisReplaceBoard(mode, rows);
    // Keep the Firestore fallback equal to Redis, including players outside
    // the compact homepage top 10.
    await store.doc(`boards/${mode}`).set({ at: Date.now(), rows });
    const back = (await redisBoard(mode, 5)) || [];
    console.log(
      `${mode.padEnd(8)} ${String(rows.length).padStart(3)} players` +
        (back.length ? ` · top: ${back[0].nickname} ${back[0].bestScore}` : ""),
    );
  } catch (e) {
    console.error(`${mode.padEnd(8)} failed: ${e.message}`);
    process.exitCode = 1;
  }
}
console.log("\nRedis now serves the boards. Firestore keeps every score.");
