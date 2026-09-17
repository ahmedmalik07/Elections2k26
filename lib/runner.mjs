// Campus Dash rules. Pure functions so the client, server validation and tests agree.

export const JUMP = 0.8;
export const SLIDE = 0.75;
export const FLY = 5;
export const MAGNET = 7;
export const DOUBLE = 8;
export const CHAIN_WINDOW = 3;
export const ZONE_LENGTH = 650;
export const MAX_SPEED = 44;
export const MIN_GAP = 0.62;
export const VOTE_POINTS = 25;
export const COLLAB_POINTS = 300;
export const COLLAB_EVERY = 20;

// Every hurdle is jumped, every wall is dodged, every bar is slid under.
// Labels change per campus; colours and rules never do.
export const zones = [
  {
    id: "e9",
    name: "Air University Islamabad",
    sub: "E-9 main campus",
    hurdle: "QUIZ",
    wall: "DEADLINE",
    bar: "ATTENDANCE",
    boost: {},
  },
  {
    id: "library",
    name: "Central Library",
    sub: "Silence, please",
    hurdle: "BOOKS",
    wall: "OVERDUE",
    bar: "SILENCE",
    boost: { bar: 2.2 },
  },
  {
    id: "cafe",
    name: "Cafe Street",
    sub: "Chai, fries and gossip",
    hurdle: "SPILL",
    wall: "QUEUE",
    bar: "MENU",
    boost: { chai: 3 },
  },
  {
    id: "fmc",
    name: "Fazaia Medical College",
    sub: "FMC, Air University",
    hurdle: "VIVA",
    wall: "OSCE",
    bar: "WARD ROUND",
    boost: { magnet: 2 },
  },
  {
    id: "kamra",
    name: "Aerospace & Aviation Campus",
    sub: "AU Kamra, JF-17 country",
    hurdle: "CONE",
    wall: "HANGAR",
    bar: "WING",
    boost: { wings: 3, bus: 1.5 },
  },
  {
    id: "multan",
    name: "Air University Multan",
    sub: "Mangoes and 45° heat",
    hurdle: "MANGO",
    wall: "HEAT 45°",
    bar: "LOO",
    boost: { quiz: 1.5 },
  },
  {
    id: "hack",
    name: "GDGOC Hackathon Hall",
    sub: "24 hours, zero sleep",
    hurdle: "BUG",
    wall: "DEADLINE",
    bar: "MERGE",
    boost: { deadline: 1.6, double: 3 },
  },
];

export const universities = [
  "NUST",
  "FAST",
  "COMSATS",
  "QAU",
  "Bahria",
  "NUML",
  "IIUI",
  "PIEAS",
  "IST",
  "UET",
  "GIKI",
  "LUMS",
];

// Facts about Ahmed, shown mid-zone so they never clash with zone banners.
export const milestones = [
  { at: 300, text: "Ahmed has won 4 national hackathons. Keep that pace." },
  { at: 950, text: "Ahmed’s startup is incubated at NIC Islamabad." },
  { at: 1600, text: "5 internships for Ahmed. How many km for you?" },
  { at: 2250, text: "Ahmed is Technical Co-Lead at GDGOC AU. VP next?" },
  { at: 2900, text: "More hackathons and inter-uni collabs: Ahmed’s plan." },
  { at: 3550, text: "Vote Ahmed Malik, Roll No. 241981, on 21 & 22 Sept." },
];

export const zoneIndex = (distance) => Math.floor(distance / ZONE_LENGTH);
export const zoneAt = (distance) => zones[zoneIndex(distance) % zones.length];
export const runnerSpeed = (time) => 22 + Math.min(time * 0.2, MAX_SPEED - 22);
export const approachSpeed = (time) => 0.28 + (runnerSpeed(time) - 22) * 0.01;
export const spawnGap = (time) => Math.max(MIN_GAP, 1.35 - time / 120);
export const multiplier = (chain) => Math.min(5, 1 + Math.floor(chain / 8));
export const votePoints = (chain, doubled) =>
  VOTE_POINTS * multiplier(chain) * (doubled ? 2 : 1);
export const runnerScore = (distance, points) => Math.floor(distance) + points;

const PICKUPS = new Set([
  "vote",
  "chai",
  "wings",
  "magnet",
  "double",
  "collab",
]);
export const isPickup = (kind) => PICKUPS.has(kind);

// power: { jump, slide, fly, magnet } timers in seconds.
export function runnerCollision(kind, itemLane, playerLane, power = {}) {
  const inLane = Math.abs(itemLane - playerLane) < 0.53;
  if (kind === "vote") return inLane || power.magnet > 0 ? "collect" : "miss";
  if (!inLane) return "miss";
  if (PICKUPS.has(kind)) return "collect";
  if (power.fly > 0) return "clear";
  const jump = power.jump || 0;
  if (kind === "quiz") return jump >= 0.1 && jump <= 0.7 ? "clear" : "crash";
  if (kind === "bar") return (power.slide || 0) > 0.05 ? "clear" : "crash";
  return "crash";
}

function weighted(options, random) {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, w] of options) if ((roll -= w) < 0) return value;
  return options[options.length - 1][0];
}
const otherLanes = (lane) => [-1, 0, 1].filter((l) => l !== lane);

export function voteTrail(lane, count, start = 0) {
  return Array.from({ length: count }, (_, i) => ({
    lane,
    kind: "vote",
    z: start - i * 0.07,
  }));
}

export const BUS_BOOST = 0.3;
// A shuttle overtakes rows already on the road. It must only share arrival
// time with rows in lanes that are already blocked, never a row's free lane.
export function busLane(time, items, random = Math.random) {
  const a = approachSpeed(time),
    meet = (0.88 * BUS_BOOST) / (a + BUS_BOOST);
  const nearby = items.filter(
    (i) => !isPickup(i.kind) && Math.abs(i.z - meet) < 0.16,
  );
  if (!nearby.length) return Math.floor(random() * 3) - 1;
  const blocked = [...new Set(nearby.map((i) => i.lane))];
  return blocked[Math.floor(random() * blocked.length)];
}

export function runnerRow(
  time,
  zone = zones[0],
  random = Math.random,
  items = [],
) {
  const lane = Math.floor(random() * 3) - 1;
  const boost = (k) => zone.boost?.[k] || 1;
  if (time < 4) return voteTrail(lane, 3);
  const difficulty = Math.min(1, time / 120);
  const roll = random();
  if (time > 8 && roll < 0.09) {
    const kind = weighted(
      [
        ["chai", 3 * boost("chai")],
        ["wings", 1.2 * boost("wings")],
        ["magnet", 1.6 * boost("magnet")],
        ["double", 1.4 * boost("double")],
      ],
      random,
    );
    const [other] = otherLanes(lane);
    return [{ lane, kind, z: 0 }, ...voteTrail(other, 2)];
  }
  if (roll < 0.3) return voteTrail(lane, 3 + Math.floor(random() * 3));
  if (time > 30 && random() < 0.12 * boost("bus")) {
    const bus = busLane(time, items, random);
    return [{ lane: bus, kind: "bus", z: 0 }];
  }
  const hazard = () =>
    weighted(
      [
        ["quiz", 1 * boost("quiz")],
        ["deadline", 1 * boost("deadline")],
        ["bar", (time > 12 ? 0.9 : 0) * boost("bar")],
      ],
      random,
    );
  if (time > 40 && random() < 0.1 * difficulty) {
    const kind = random() < 0.5 ? "quiz" : "bar";
    return [-1, 0, 1].map((l) => ({ lane: l, kind, z: 0 }));
  }
  if (time > 20 && random() < 0.25 + 0.35 * difficulty) {
    const [a, b] = otherLanes(lane);
    return [
      { lane: a, kind: hazard(), z: 0 },
      { lane: b, kind: hazard(), z: 0 },
      ...voteTrail(lane, 1 + Math.floor(random() * 2)),
    ];
  }
  const [other] = otherLanes(lane);
  return [{ lane, kind: hazard(), z: 0 }, ...voteTrail(other, 2)];
}

export function collabRow(count, random = Math.random) {
  const lane = Math.floor(random() * 3) - 1;
  return [
    {
      lane,
      kind: "collab",
      label: universities[count % universities.length],
      z: 0,
    },
  ];
}

export const achievements = [
  { id: "fresher", badge: "RUN", name: "Fresher run", desc: "Run 250 m" },
  {
    id: "library",
    badge: "LIB",
    name: "Bookworm",
    desc: "Reach the Central Library",
  },
  {
    id: "ninja",
    badge: "SHH",
    name: "Library ninja",
    desc: "Slide under 8 bars in one run",
  },
  {
    id: "chai",
    badge: "CHAI",
    name: "Chai addict",
    desc: "Grab 3 chai in one run",
  },
  {
    id: "fmc",
    badge: "FMC",
    name: "Ward rounds",
    desc: "Reach Fazaia Medical College",
  },
  {
    id: "kamra",
    badge: "KMR",
    name: "Kamra landing",
    desc: "Reach the Kamra aviation campus",
  },
  {
    id: "pilot",
    badge: "WING",
    name: "Fazaia pilot",
    desc: "Fly with wings twice in one run",
  },
  {
    id: "multan",
    badge: "MLN",
    name: "Multan mango",
    desc: "Reach the Multan campus",
  },
  {
    id: "hack",
    badge: "HACK",
    name: "Hackathon hall",
    desc: "Reach the GDGOC Hackathon Hall",
  },
  {
    id: "collab",
    badge: "COLAB",
    name: "Collab king",
    desc: "Run through 4 uni collab gates in one run",
  },
  {
    id: "votes",
    badge: "VOTE",
    name: "Vote bank",
    desc: "Collect 120 votes in one run",
  },
  {
    id: "fire",
    badge: "x5",
    name: "On fire",
    desc: "Hit the x5 vote multiplier",
  },
  {
    id: "vp",
    badge: "VP",
    name: "VP material",
    desc: "Score 15,000 in one run",
  },
  {
    id: "volunteer",
    badge: "20",
    name: "Campaign volunteer",
    desc: "Play 20 runs",
  },
];

// run: { distance, votes, chai, flights, slides, collabs, maxChain, score }
export function earnedAchievements(run, totals = { runs: 0 }) {
  const zone = zoneIndex(run.distance);
  const checks = {
    fresher: run.distance >= 250,
    library: zone >= 1,
    ninja: run.slides >= 8,
    chai: run.chai >= 3,
    fmc: zone >= 3,
    kamra: zone >= 4,
    pilot: run.flights >= 2,
    multan: zone >= 5,
    hack: zone >= 6,
    collab: run.collabs >= 4,
    votes: run.votes >= 120,
    fire: multiplier(run.maxChain) >= 5,
    vp: run.score >= 15000,
    volunteer: totals.runs >= 20,
  };
  return achievements.filter((a) => checks[a.id]).map((a) => a.id);
}

export function runnerRank(score) {
  return score >= 15000
    ? "Vice President material"
    : score >= 8000
      ? "Hackathon finalist"
      : score >= 4000
        ? "GDGOC core team"
        : score >= 2000
          ? "Society volunteer"
          : score >= 800
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
