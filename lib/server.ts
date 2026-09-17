import "server-only";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export function db() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    if (
      !/^(localhost|127\.0\.0\.1):8080$/.test(
        process.env.FIRESTORE_EMULATOR_HOST,
      )
    )
      throw Error("Use a localhost Firestore emulator on port 8080.");
    if (!getApps().length) initializeApp({ projectId: "demo-jaago-campus" });
    return getFirestore();
  }
  if (!process.env.FIREBASE_PROJECT_ID)
    throw Error(
      "Leaderboard abhi connect nahi hai. Game khelo, phir dobara check karo.",
    );
  if (!getApps().length)
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  return getFirestore();
}
function secret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw Error("Server session configuration missing.");
  return process.env.SESSION_SECRET;
}
export function sign(data: object) {
  const raw = Buffer.from(JSON.stringify(data)).toString("base64url");
  return (
    raw + "." + createHmac("sha256", secret()).update(raw).digest("base64url")
  );
}
export function verify(token: string) {
  if (typeof token !== "string" || token.length > 1500)
    throw Error("Invalid session.");
  const [raw, signature] = token.split(".");
  const expected = createHmac("sha256", secret())
    .update(raw || "")
    .digest("base64url");
  if (
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw Error("Invalid session.");
  return JSON.parse(Buffer.from(raw, "base64url").toString());
}
export async function owner() {
  const value = (await cookies()).get("jaago-player")?.value;
  if (!value) throw Error("Pehle nickname set karo.");
  const data = verify(value);
  if (data.kind !== "player") throw Error("Invalid player.");
  return data.id as string;
}
export const code = () =>
  randomBytes(5).toString("hex").slice(0, 6).toUpperCase();
export async function getChallenge(id: string) {
  if (!/^[A-F0-9]{6}$/.test(id)) return null;
  const doc = await db().collection("challenges").doc(id).get();
  return doc.exists ? doc.data()! : null;
}
