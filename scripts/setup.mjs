import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
const target = path.resolve(".env.local");
if (fs.existsSync(target))
  throw Error(
    ".env.local already exists. Edit it directly; setup will not overwrite your secrets.",
  );
const source = process.argv[2];
if (!source)
  throw Error(
    'Usage: npm run setup -- "C:/path/to/service-account.json" "https://your-site.vercel.app"',
  );
const data = JSON.parse(fs.readFileSync(path.resolve(source), "utf8"));
if (
  !data.project_id ||
  !data.client_email ||
  !data.private_key?.includes("BEGIN PRIVATE KEY")
)
  throw Error("Choose the Firebase Admin SDK service-account JSON file.");
const site = process.argv[3] || "http://localhost:3000";
const url = new URL(site);
if (!["http:", "https:"].includes(url.protocol))
  throw Error("Use an HTTP or HTTPS site URL.");
const values = {
  FIREBASE_PROJECT_ID: data.project_id,
  FIREBASE_CLIENT_EMAIL: data.client_email,
  FIREBASE_PRIVATE_KEY: data.private_key,
  SESSION_SECRET: randomBytes(32).toString("hex"),
  ADMIN_KEY: randomBytes(32).toString("hex"),
  NEXT_PUBLIC_SITE_URL: url.origin,
};
fs.writeFileSync(
  target,
  Object.entries(values)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Created .env.local with Firebase settings and two separate random secrets. Nothing secret was printed. Restart the app, then visit /api/health. Copy the six values into Vercel settings before deploying. Do not upload the JSON key or .env.local to GitHub.",
);
