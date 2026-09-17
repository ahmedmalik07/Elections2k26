const origin = process.env.SMOKE_URL || "http://localhost:3000";
const pages = [
  "/",
  "/run",
  "/arcade",
  "/ahmed",
  "/play?game=easy",
  "/play?game=classic",
  "/play?game=chai",
  "/play?game=memory",
  "/leaderboard?game=memory",
  "/print",
  "/admin",
  "/manifest.webmanifest",
  "/icon",
  "/api/og",
  "/ahmed-speaking.jpg",
];
let failed = false;
for (const page of pages) {
  const r = await fetch(origin + page);
  if (!r.ok) failed = true;
  console.log(`${r.status} ${page}`);
}
const invalid = await fetch(origin + "/api/score", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "fake", score: 999999 }),
});
if (invalid.ok) failed = true;
console.log(`${invalid.status} invalid submission rejected: ${!invalid.ok}`);
const health = await fetch(origin + "/api/health");
console.log(`Online services: ${JSON.stringify(await health.json())}`);
if (failed) process.exitCode = 1;
