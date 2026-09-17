export const games = [
  {
    id: "easy",
    name: "Chill Campus",
    tag: "Start here",
    level: "Easy",
    seconds: 45,
    color: "green",
    icon: "chair",
    description: "Bigger breathing room. Slower clouds. No early game over.",
    instruction: "Tap the grey clouds. Every pop wakes nearby students.",
    stat: "Students woken",
  },
  {
    id: "chai",
    name: "Chai & Code",
    tag: "Fuel the build",
    level: "Very easy",
    seconds: 30,
    color: "yellow",
    icon: "chai",
    description: "Serve hot chai to the coding crew. One tap at a time.",
    instruction:
      "Tap the yellow cup. It moves after every tap. No penalty for a miss.",
    stat: "Cups served",
  },
  {
    id: "memory",
    name: "Dev Match",
    tag: "Think like a dev",
    level: "Easy",
    seconds: 90,
    color: "pink",
    icon: "trophy",
    description:
      "HTML, Git, APIs. Match six tech pairs and learn what each one does.",
    instruction:
      "Match two identical tech cards. Fewer wrong guesses means a better score.",
    stat: "Pairs found",
  },
  {
    id: "classic",
    name: "Bore Buster",
    tag: "The original",
    level: "Challenge",
    seconds: 45,
    color: "blue",
    icon: "mic",
    description: "45 seconds. Heavy clouds. Combos. Full campus chaos.",
    instruction:
      "Pop clouds before they put students to sleep. Chain quick taps for combos.",
    stat: "Students woken",
  },
];
export function gameInfo(id) {
  return games.find((g) => g.id === id) || games[3];
}
export function validGame(id) {
  return games.some((g) => g.id === id);
}
export function memoryScore(pairs, mistakes) {
  return pairs * 50 + (pairs === 6 ? Math.max(0, 120 - mistakes * 10) : 0);
}
export function earnedCards(mode, events) {
  if (mode === "chai") return events >= 1 ? ["chai"] : [];
  if (mode === "memory")
    return ["chair", "trophy", "mic", "chai"].slice(0, Math.min(4, events));
  return [];
}
export function gameRank(mode, score) {
  if (mode === "memory")
    return score >= 400
      ? "Memory master"
      : score >= 300
        ? "Pair professor"
        : score >= 150
          ? "Getting warmer"
          : "Fresh start";
  if (mode === "chai")
    return score >= 400
      ? "Chai legend"
      : score >= 200
        ? "Canteen hero"
        : score >= 100
          ? "Chai regular"
          : "First cup";
  return score >= 700
    ? "Baithaq legend"
    : score >= 450
      ? "Hackathon material"
      : score >= 250
        ? "Society ka banda"
        : score >= 100
          ? "Canteen regular"
          : "Certified bore";
}
export function shufflePairs(random = Math.random) {
  const values = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
// Every game with a shared leaderboard. Campus Dash lives at /run, not inside the arcade grid.
export const boards = [
  { id: "dash", name: "Campus Dash", href: "/run" },
  ...games.map((g) => ({ id: g.id, name: g.name, href: "/play?game=" + g.id })),
];
export function validBoard(id) {
  return boards.some((b) => b.id === id);
}
