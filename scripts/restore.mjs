// Puts players and scores from a backup back into Firestore.
//
//   npm run restore -- backups/backup-....json      check a local file
//   npm run restore -- --cloud                       check the newest cloud copy
//   add --apply to actually write
//
// It only ever adds documents that are missing. Anything already in Firestore
// is left exactly as it is, so running it can't undo newer scores. Without
// --apply it only reports what it would restore.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { latestCloudBackup } from "../lib/cloudBackup.mjs";

const root = process.cwd();
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    const match = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const file = args.find((a) => !a.startsWith("--"));

let backup;
if (args.includes("--cloud")) {
  const latest = await latestCloudBackup();
  if (!latest) {
    console.error("No cloud backup found in Upstash.");
    process.exit(1);
  }
  backup = JSON.parse(latest.body);
  console.log(`Using the cloud backup from ${latest.day}.`);
} else if (file) {
  backup = JSON.parse(readFileSync(file, "utf8"));
  console.log(`Using ${file}.`);
} else {
  console.error(
    "Say which backup to use:\n" +
      "  npm run restore -- backups/backup-....json\n" +
      "  npm run restore -- --cloud",
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

let missing = 0;
for (const name of ["players", "scores"]) {
  const docs = backup[name] || [];
  const refs = docs.map((d) => store.doc(`${name}/${d.id}`));
  const existing = refs.length ? await store.getAll(...refs) : [];
  const toAdd = docs.filter((_, i) => !existing[i].exists);
  missing += toAdd.length;
  console.log(
    `${name.padEnd(8)} ${docs.length} in backup, ${toAdd.length} missing from Firestore`,
  );
  if (apply)
    for (let i = 0; i < toAdd.length; i += 400) {
      const batch = store.batch();
      for (const { id, ...data } of toAdd.slice(i, i + 400))
        batch.set(store.doc(`${name}/${id}`), data);
      await batch.commit();
    }
}
console.log(
  missing === 0
    ? "\nNothing is missing. Firestore already has everything in this backup."
    : apply
      ? `\nRestored ${missing} documents. Run npm run sync:redis to refresh the boards.`
      : "\nNothing written. Add --apply to restore the missing documents.",
);
process.exit(0);
