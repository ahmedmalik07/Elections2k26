import { validBoard, memoryScore, earnedCards } from "./arcade.mjs";
import {
  runnerScore,
  MAX_SPEED,
  MIN_GAP,
  VOTE_POINTS,
  COLLAB_POINTS,
  COLLAB_EVERY,
} from "./runner.mjs";
export function validNickname(value) {
  if (typeof value !== "string")
    throw Error("Nickname 3 se 16 characters ka rakho.");
  const name = value.replace(/<[^>]*>/g, "").trim();
  if (!/^[\p{L}\p{N} _.-]{3,16}$/u.test(name))
    throw Error(
      "Nickname 3 se 16 characters ka rakho. Letters aur numbers use karo.",
    );
  if (
    /ahmed\s*malik|admin|official|fuck|shit|bitch|cunt|chut|bhen|behen|madar|lund|randi|harami|bhos|gaand/i.test(
      name,
    )
  )
    throw Error("Yeh nickname use nahi ho sakta. Doosra naam chuno.");
  return name;
}
export function validateScore(b, elapsed, mode = "classic") {
  if (!validBoard(mode) || (b.mode !== undefined && b.mode !== mode))
    throw Error("Game does not match this session.");
  if (mode === "dash") {
    for (const k of [
      "score",
      "votes",
      "distance",
      "durationMs",
      "points",
      "collabs",
    ])
      if (!Number.isSafeInteger(b[k]) || b[k] < 0)
        throw Error("Invalid run. Dobara khelo.");
    const seconds = b.durationMs / 1000;
    // Speed tops out at MAX_SPEED; rows arrive at most every MIN_GAP with up to
    // 5 votes; votes earn at most x5 and x2; a collab gate opens every 20 s.
    if (
      elapsed > 1800000 ||
      b.durationMs < 1000 ||
      b.durationMs > elapsed + 1500 ||
      b.distance > seconds * MAX_SPEED + 5 ||
      b.votes > (seconds / MIN_GAP) * 5 + 5 ||
      b.collabs > seconds / COLLAB_EVERY + 1 ||
      b.points > b.votes * VOTE_POINTS * 10 + b.collabs * COLLAB_POINTS ||
      b.points < b.votes * VOTE_POINTS + b.collabs * COLLAB_POINTS ||
      b.score !== runnerScore(b.distance, b.points)
    )
      throw Error("Invalid Campus Dash run.");
    return true;
  }
  for (const k of [
    "score",
    "woken",
    "pops",
    "maxCombo",
    "powerupsUsed",
    "durationMs",
  ])
    if (!Number.isSafeInteger(b[k]) || b[k] < 0)
      throw Error("Invalid score. Dobara khelo.");
  if (mode === "chai" || mode === "memory") {
    if (
      b.earlyEnd !== false ||
      elapsed > 150000 ||
      b.durationMs > elapsed + 500 ||
      b.durationMs < 1000 ||
      b.woken !== 0 ||
      b.pops !== 0 ||
      b.maxCombo !== 0 ||
      b.powerupsUsed !== 0
    )
      throw Error("Invalid arcade round.");
    for (const k of ["hits", "pairs", "mistakes"])
      if (!Number.isSafeInteger(b[k]) || b[k] < 0)
        throw Error("Invalid arcade counters.");
    if (
      mode === "chai" &&
      (elapsed < 30000 ||
        b.durationMs < 29900 ||
        b.durationMs > 30500 ||
        b.hits > 300 ||
        b.pairs !== 0 ||
        b.mistakes !== 0 ||
        b.score !== b.hits * 10)
    )
      throw Error("Invalid Chai Tap score.");
    if (
      mode === "memory" &&
      (b.hits !== 0 ||
        b.pairs > 6 ||
        b.mistakes > 200 ||
        b.durationMs > 90500 ||
        (b.pairs < 6 && b.durationMs < 89900) ||
        b.durationMs < (b.pairs + b.mistakes) * 150 ||
        b.score !== memoryScore(b.pairs, b.mistakes))
    )
      throw Error("Invalid Campus Match score.");
    return true;
  }
  if (mode === "easy" && b.earlyEnd)
    throw Error("Chill Campus has no early game over.");
  if (
    typeof b.earlyEnd !== "boolean" ||
    elapsed < (b.earlyEnd ? 8000 : 40000) ||
    elapsed > 120000
  )
    throw Error("Round timing invalid. Dobara khelo.");
  if (
    b.durationMs > (b.earlyEnd ? 45000 : 45500) ||
    b.durationMs < (b.earlyEnd ? 3000 : 44500) ||
    b.durationMs > elapsed + 1000
  )
    throw Error("Round duration invalid.");
  if (
    b.pops > 70 ||
    b.woken > 180 ||
    b.maxCombo > 5 ||
    b.powerupsUsed > 5 ||
    b.score > 2 * (b.pops * 10 * 5 + b.woken * 15 * 5 + b.powerupsUsed * 100)
  )
    throw Error("Score invalid. Dobara khelo.");
  return true;
}
export function validatedCards(b, mode) {
  if (mode === "dash") return [];
  if (mode === "chai" || mode === "memory")
    return earnedCards(mode, mode === "chai" ? b.hits : b.pairs);
  return Array.isArray(b.cards)
    ? [
        ...new Set(
          b.cards.filter((v) => ["chair", "trophy", "chai", "mic"].includes(v)),
        ),
      ].slice(0, b.powerupsUsed)
    : [];
}
