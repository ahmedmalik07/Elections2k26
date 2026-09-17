// Local emulator only. Never run against a production project.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
if (
  !/^127\.0\.0\.1:8080$|^localhost:8080$/.test(
    process.env.FIRESTORE_EMULATOR_HOST || "",
  )
)
  throw Error(
    "Seed requires a localhost Firestore emulator on port 8080. Production seeding is blocked.",
  );
initializeApp({ projectId: "demo-jaago-campus" });
const db = getFirestore(),
  batch = db.batch();
for (let i = 0; i < 12; i++)
  batch.set(db.doc(`players/demo-${i}`), {
    nickname: `Demo player ${i + 1}`,
    department: "Computing & AI",
    bestScore: 80 + i * 45,
    totalWoken: 0,
    plays: 0,
    cards: [],
    cardsCollected: 0,
    banned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
batch.set(db.doc("stats/global"), {
  totalPlays: 0,
  totalWoken: 0,
  uniquePlayers: 12,
});
batch.set(db.doc("departments/Computing & AI"), {
  name: "Computing & AI",
  totalWoken: 0,
  playerCount: 12,
});
await batch.commit();
console.log("Added 12 clearly labeled emulator-only demo players.");
