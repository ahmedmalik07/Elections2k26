export function runnerScore(distance, coins) {
  return Math.floor(distance) + coins * 25;
}
export function runnerCollision(kind, obstacleLane, playerLane, jumpRemaining) {
  if (Math.abs(obstacleLane - playerLane) >= 0.53) return "miss";
  if (kind === "coin") return "collect";
  if (kind === "barrier" && jumpRemaining >= 0.12 && jumpRemaining <= 0.75) return "clear";
  return "crash";
}
export function runnerRow(time, random = Math.random) {
  const lane = Math.floor(random() * 3) - 1;
  const kind = time < 5 || random() < 0.35 ? "coin" : random() < 0.6 ? "barrier" : "block";
  const row = [{ lane, kind, z: 0 }];
  if (kind !== "coin") row.push({ lane: lane === 1 ? 0 : lane + 1, kind: "coin", z: 0 });
  return row;
}
