export function runnerScore(distance, votes) {
  return Math.floor(distance) + votes * 25;
}
// "vote" and "chai" are pickups; "quiz" is a low hurdle you jump; "deadline" is a tall wall you dodge.
export function runnerCollision(kind, obstacleLane, playerLane, jumpRemaining) {
  if (Math.abs(obstacleLane - playerLane) >= 0.53) return "miss";
  if (kind === "vote" || kind === "chai") return "collect";
  if (kind === "quiz" && jumpRemaining >= 0.12 && jumpRemaining <= 0.75)
    return "clear";
  return "crash";
}
export function runnerRow(time, random = Math.random) {
  const lane = Math.floor(random() * 3) - 1;
  if (time < 5 || random() < 0.35) {
    const kind = time > 12 && random() < 0.1 ? "chai" : "vote";
    return [{ lane, kind, z: 0 }];
  }
  const kind = random() < 0.6 ? "quiz" : "deadline";
  return [
    { lane, kind, z: 0 },
    { lane: lane === 1 ? 0 : lane + 1, kind: "vote", z: 0 },
  ];
}
export const milestones = [
  {
    at: 150,
    text: "Through the E-9 gate, running in Ahmed’s No. 241981 jersey.",
  },
  { at: 350, text: "Fun fact: Ahmed has won 4 national hackathons." },
  { at: 650, text: "Ahmed’s startup is incubated at NIC Islamabad." },
  { at: 1000, text: "1 km! Ahmed has done 5 internships. You’ve done 1 km." },
  { at: 1500, text: "GDGOC Technical Co-Lead today. Vice President next?" },
  { at: 2200, text: "Vote Ahmed Malik, Roll No. 241981, on 21 & 22 Sept." },
];
export function runnerRank(score) {
  return score >= 2500
    ? "Vice President material"
    : score >= 1500
      ? "Hackathon finalist"
      : score >= 900
        ? "GDGOC core team"
        : score >= 450
          ? "Society volunteer"
          : score >= 200
            ? "Canteen regular"
            : "Fresher on day one";
}
const DAY = 86_400_000;
export function votingCountdown(now, startIso, endIso) {
  const start = Date.parse(startIso),
    end = Date.parse(endIso);
  if (now > end) return null;
  if (now >= start) return "Voting is open now";
  const days = Math.ceil((start - now) / DAY);
  return days <= 1 ? "Voting starts tomorrow" : `Voting in ${days} days`;
}
