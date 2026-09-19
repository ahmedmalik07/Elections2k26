// Review scores players recovered from their device.
//
//   npm run claims                     list everything waiting
//   npm run claims -- --approve <id>   put that score on the board
//   npm run claims -- --reject <id>    throw it away
//   npm run claims -- --approve-all    approve everything listed
//
// These scores have no signed run behind them: a player's device remembered a
// number the old server refused to store. Approving one is a judgement call,
// which is why it is never automatic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { redisReady, redisSaveScore } from "../lib/redisBoard.mjs";

const root = process.cwd();
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error("No Firebase credentials in .env.local.");
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

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] || true : null;
};

async function approve(id) {
  const ref = store.doc(`claims/${id}`);
  const claim = (await ref.get()).data();
  if (!claim) return console.error(`  ${id}: not found`);
  const mode = claim.mode || "dash";
  const pRef = store.doc(`players/${claim.playerId}`);
  const row = await store.runTransaction(async (tx) => {
    const p = await tx.get(pRef);
    if (!p.exists) throw Error("player not found");
    const player = p.data();
    const best = Math.max(
      (mode === "classic" ? player.bestScore : player.bestScores?.[mode]) || 0,
      claim.score,
    );
    tx.update(pRef, {
      bestScore: mode === "classic" ? best : player.bestScore,
      bestScores: { ...(player.bestScores || {}), [mode]: best },
      updatedAt: Date.now(),
      creditedClaims: [
        ...(player.creditedClaims || []),
        { mode, score: claim.score, at: Date.now() },
      ],
    });
    tx.set(ref, { ...claim, status: "approved", closedAt: Date.now() });
    return {
      id: claim.playerId,
      nickname: player.nickname,
      department: player.department,
      cardsCollected: player.cardsCollected || 0,
      bestScore: best,
    };
  });
  if (redisReady())
    await redisSaveScore(mode, row).catch((e) =>
      console.error(
        "  (redis update failed, next rebuild fixes it)",
        e.message,
      ),
    );
  // Force the cached boards to rebuild so the new score appears.
  await store.doc(`boards/${mode}`).set({ at: 0, rows: [] });
  console.log(
    `  approved: ${row.nickname} -> ${row.bestScore.toLocaleString()}`,
  );
}

const id = flag("--approve") || flag("--reject");
if (flag("--reject") && typeof flag("--reject") === "string") {
  const ref = store.doc(`claims/${flag("--reject")}`);
  const claim = (await ref.get()).data();
  if (!claim) console.error("not found");
  else {
    await ref.set({ ...claim, status: "rejected", closedAt: Date.now() });
    console.log(`rejected ${claim.nickname}'s ${claim.score}`);
  }
  process.exit(0);
}
if (typeof flag("--approve") === "string") {
  await approve(flag("--approve"));
  process.exit(0);
}

const pending = (
  await store.collection("claims").where("status", "==", "pending").get()
).docs.map((d) => ({ id: d.id, ...d.data() }));

if (!pending.length) {
  console.log("No recovered scores waiting.");
  process.exit(0);
}
console.log(`${pending.length} recovered score(s) waiting:\n`);
for (const c of pending)
  console.log(
    `  ${c.id}\n    ${c.nickname} (${c.department})  ${Number(c.score).toLocaleString()}  ` +
      `currently on board: ${Number(c.onBoard || 0).toLocaleString()}  sent ${new Date(c.createdAt).toLocaleString()}`,
  );

if (args.includes("--approve-all")) {
  console.log("\napproving all:");
  for (const c of pending) await approve(c.id);
} else {
  console.log(
    "\nApprove one with:  npm run claims -- --approve <id>" +
      "\nReject one with:   npm run claims -- --reject <id>",
  );
}
process.exit(0);
