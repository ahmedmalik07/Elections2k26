"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { campaign } from "@/config/campaign";
import {
  achievements,
  approachSpeed,
  BUS_BOOST,
  CHAIN_WINDOW,
  COLLAB_EVERY,
  COLLAB_POINTS,
  collabRow,
  DOUBLE,
  earnedAchievements,
  FLY,
  JUMP,
  MAGNET,
  milestones,
  multiplier,
  runnerCollision,
  runnerRank,
  runnerRow,
  runnerScore,
  runnerSpeed,
  SLIDE,
  spawnGap,
  voteTrail,
  votePoints,
  votingCountdown,
  zoneAt,
  zoneIndex,
  zones,
  ZONE_LENGTH,
} from "@/lib/runner.mjs";
import LiveBoard from "./LiveBoard";
import Brand from "./Brand";
import { createRunnerAudio } from "./runnerAudio";
import { C, drawScene, type Item, type Phase, type Run } from "./runnerScene";
import "./runner.css";
import {
  PENDING_SCORES_KEY,
  enqueueScore,
  acknowledgeScore,
  nextPendingScore,
} from "@/lib/pendingScores.mjs";

async function post(path: string, body: unknown) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const savedPlayer = () =>
  readJson<{ nickname: string; department: string } | null>(
    "jaago-player",
    null,
  );

const fresh = (): Run => ({
  phase: "ready",
  lane: 0,
  visualLane: 0,
  jump: 0,
  slide: 0,
  fly: 0,
  magnet: 0,
  double: 0,
  shield: false,
  grace: 0,
  shake: 0,
  flash: 0,
  distance: 0,
  time: 0,
  spawn: 1.2,
  collabTimer: 15,
  collabsSpawned: 0,
  items: [],
  sparks: [],
  floaters: [],
  votes: 0,
  points: 0,
  chain: 0,
  chainTimer: 0,
  maxChain: 0,
  chai: 0,
  flights: 0,
  slides: 0,
  collabs: 0,
  milestone: 0,
  zone: 0,
});
type Hud = {
  distance: number;
  votes: number;
  points: number;
  chain: number;
  chainLeft: number;
  shield: boolean;
  fly: number;
  magnet: number;
  double: number;
  zone: number;
};
const emptyHud: Hud = {
  distance: 0,
  votes: 0,
  points: 0,
  chain: 0,
  chainLeft: 0,
  shield: false,
  fly: 0,
  magnet: 0,
  double: 0,
  zone: 0,
};
const CRASH_TIPS: Record<string, string> = {
  quiz: "Pink hurdles: jump just before they reach you.",
  bar: "Purple bars: swipe down (or ↓) to slide under them.",
  deadline: "Blue walls are too tall to jump. Switch lanes.",
  bus: "Watch for the red ! — an AU shuttle is coming. Change lanes early.",
};

export default function CampusRunner() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<Run>(fresh());
  const audio = useRef<ReturnType<typeof createRunnerAudio>>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState<Hud>(emptyHud);
  const [best, setBest] = useState(0);
  const [crashTip, setCrashTip] = useState("");
  const [toast, setToast] = useState<{ text: string; kind: string } | null>(
    null,
  );
  const [countdown, setCountdown] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [brainrot, setBrainrot] = useState(true);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [newThisRun, setNewThisRun] = useState<string[]>([]);
  const bestRef = useRef(0);
  const unlockedRef = useRef<string[]>([]);
  const runsRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Leaderboard: each run gets a signed token; only new personal bests are submitted.
  const token = useRef<Promise<string | null>>(Promise.resolve(null));
  const pending = useRef<Record<string, unknown> | null>(null);
  const submitting = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [unsentScore, setUnsentScore] = useState(0);
  const boardBest = useRef(0);
  const [claim, setClaim] = useState<
    "idle" | "ask" | "saving" | "saved" | "failed"
  >("idle");
  const [rank, setRank] = useState<{ rank: number; total: number } | null>(
    null,
  );
  const [boardKey, setBoardKey] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState(campaign.departments[0]);
  const [sheetError, setSheetError] = useState("");
  const [busy, setBusy] = useState(false);
  const score = runnerScore(hud.distance, hud.points);
  const zone = zones[hud.zone % zones.length];
  const shareText = `I scored ${score.toLocaleString()} in Campus Dash and reached ${zone.name}. Beat that: ${campaign.siteUrl}/run\n\nVote ${campaign.candidateName} (Roll No. ${campaign.rollNumber}) for ${campaign.position}, ${campaign.votingLabel}.`;

  function changePhase(next: Phase) {
    state.current.phase = next;
    setPhase(next);
    if (next === "running")
      audio.current?.startMusic(() => runnerSpeed(state.current.time));
    else audio.current?.stopMusic();
  }
  function showToast(text: string, kind = "info", ms = 2400) {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }
  function start() {
    state.current = fresh();
    // Development only: /run?zone=3 starts at that campus with no crashes, for playtesting.
    if (process.env.NODE_ENV !== "production") {
      const params = new URLSearchParams(location.search);
      const z = Number(params.get("zone"));
      if (params.has("zone") && Number.isInteger(z) && z >= 0) {
        state.current.distance = z * ZONE_LENGTH + 1;
        state.current.zone = z;
        state.current.time = 60;
        state.current.grace = 9999;
      }
    }
    setHud(emptyHud);
    setToast(null);
    setClaim("idle");
    setRank(null);
    setNewThisRun([]);
    audio.current?.unlock();
    token.current = post("session/start", { mode: "dash" })
      .then((d) => d.token as string)
      .catch(() => null);
    changePhase("running");
    canvas.current?.focus();
  }
  function move(direction: number) {
    const s = state.current;
    if (s.phase === "running")
      s.lane = Math.max(-1, Math.min(1, s.lane + direction));
  }
  function jump() {
    const s = state.current;
    if (s.phase !== "running" || s.jump > 0 || s.fly > 0) return;
    s.jump = JUMP;
    s.slide = 0;
    audio.current?.jump();
  }
  function slide() {
    const s = state.current;
    if (s.phase !== "running" || s.fly > 0) return;
    s.slide = SLIDE;
    s.jump = 0;
    audio.current?.slide();
  }
  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (audio.current) audio.current.muted = next;
    writeJson("campus-dash-muted", next);
    if (!next && state.current.phase === "running")
      audio.current?.startMusic(() => runnerSpeed(state.current.time));
  }
  function toggleBrainrot() {
    const next = !brainrot;
    setBrainrot(next);
    if (audio.current) audio.current.brainrot = next;
    writeJson("campus-dash-brainrot", next);
  }
  async function submit(retried = false): Promise<void> {
    if (submitting.current && !retried) return;
    const body =
      nextPendingScore(readJson(PENDING_SCORES_KEY, [])) || pending.current;
    if (!body) return;
    submitting.current = true;
    setClaim("saving");
    try {
      const saved = await post("score", body);
      const remaining = acknowledgeScore(
        readJson(PENDING_SCORES_KEY, []),
        body.token,
      );
      writeJson(PENDING_SCORES_KEY, remaining);
      pending.current = nextPendingScore(remaining);
      setUnsentScore(Number(pending.current?.score || 0));
      setSaveError("");
      boardBest.current = Math.max(boardBest.current, Number(body.score));
      writeJson("campus-dash-board-best", boardBest.current);
      setRank(saved);
      setClaim("saved");
      setBoardKey((k) => k + 1);
      if (remaining.length) setTimeout(() => void submit(), 500);
    } catch (e) {
      const player = savedPlayer();
      // The player cookie can expire while the nickname is still on this device.
      if (!retried && player && /nickname|player/i.test((e as Error).message)) {
        try {
          await post("player", player);
          return await submit(true);
        } catch {}
      }
      setClaim("failed");
      setSaveError(
        (e as Error).message || "Connection interrupted. Please retry.",
      );
    } finally {
      submitting.current = false;
    }
  }
  async function endRun(s: Run, final: number) {
    // Capture this run before awaiting: an immediate replay replaces state/token.
    const tokenPromise = token.current;
    const body = {
      mode: "dash",
      score: final,
      votes: s.votes,
      points: s.points,
      collabs: s.collabs,
      distance: Math.floor(s.distance),
      durationMs: Math.round(s.time * 1000),
    };
    const runToken = await tokenPromise;
    if (!runToken || final <= 0) {
      if (final > 0) {
        setClaim("failed");
        setSaveError(
          "This run started offline and has no signed session. It is saved only on this device.",
        );
      }
      return;
    }
    const queued = enqueueScore(readJson(PENDING_SCORES_KEY, []), {
      ...body,
      token: runToken,
    });
    writeJson(PENDING_SCORES_KEY, queued);
    pending.current = nextPendingScore(queued);
    setUnsentScore(Number(pending.current?.score || 0));
    if (savedPlayer()) await submit();
    else setClaim("ask");
  }
  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSheetError("");
    try {
      const { validNickname } = await import("@/lib/validation.mjs");
      const player = await post("player", {
        nickname: validNickname(nickname),
        department,
      });
      writeJson("jaago-player", player);
      setSheet(false);
      await submit();
    } catch (err) {
      setSheetError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const retry = () => {
      pending.current = nextPendingScore(readJson(PENDING_SCORES_KEY, []));
      setUnsentScore(Number(pending.current?.score || 0));
      if (pending.current && savedPlayer()) void submit();
      else if (pending.current) setClaim("ask");
    };
    retry();
    window.addEventListener("online", retry);
    const interval = setInterval(retry, 60000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    audio.current = createRunnerAudio();
    const quiet = readJson("campus-dash-muted", false);
    audio.current.muted = quiet;
    setMuted(quiet);
    const rot = readJson("campus-dash-brainrot", true);
    audio.current.brainrot = rot;
    setBrainrot(rot);
    setCountdown(
      votingCountdown(Date.now(), campaign.votingDate, campaign.votingEndDate),
    );
    const saved = Number(readJson("campus-dash-best", 0));
    if (saved > 0) {
      bestRef.current = saved;
      setBest(saved);
    }
    boardBest.current = Number(readJson("campus-dash-board-best", 0)) || 0;
    unlockedRef.current = readJson<string[]>("campus-dash-achievements", []);
    setUnlocked(unlockedRef.current);
    runsRef.current = Number(readJson("campus-dash-runs", 0)) || 0;

    const key = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        ArrowLeft: () => move(-1),
        a: () => move(-1),
        ArrowRight: () => move(1),
        d: () => move(1),
        ArrowUp: jump,
        w: jump,
        " ": jump,
        ArrowDown: slide,
        s: slide,
      };
      if (!(e.key in map) && e.key !== "Escape") return;
      if ((e.target as HTMLElement)?.closest("a,button,input,select,form"))
        return;
      e.preventDefault();
      if (e.key === "Escape") {
        if (state.current.phase === "running") changePhase("paused");
        else if (state.current.phase === "paused") changePhase("running");
      } else if (!e.repeat || e.key.startsWith("Arrow")) map[e.key]();
    };
    const hide = () => {
      if (document.hidden && state.current.phase === "running")
        changePhase("paused");
    };
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", hide);
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const face = new Image();
    face.src = "/ahmed-face.jpg";
    let frame = 0,
      last = 0,
      hudAt = 0;

    const burst = (x: number, y: number, colors: string[], count = 14) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        state.current.sparks.push({
          x,
          y,
          vx: Math.cos(a) * (60 + Math.random() * 90),
          vy: Math.sin(a) * (60 + Math.random() * 90) - 60,
          life: 0.6,
          color: colors[i % colors.length],
        });
      }
    };
    const checkAchievements = (s: Run, final = false) => {
      const earned = earnedAchievements(
        {
          distance: s.distance,
          votes: s.votes,
          chai: s.chai,
          flights: s.flights,
          slides: s.slides,
          collabs: s.collabs,
          maxChain: s.maxChain,
          score: runnerScore(s.distance, s.points),
        },
        { runs: runsRef.current },
      );
      const fresh = earned.filter((id) => !unlockedRef.current.includes(id));
      if (!fresh.length) return;
      unlockedRef.current = [...unlockedRef.current, ...fresh];
      writeJson("campus-dash-achievements", unlockedRef.current);
      setUnlocked(unlockedRef.current);
      setNewThisRun((list) => [...list, ...fresh]);
      const first = achievements.find((a) => a.id === fresh[0])!;
      if (!final) {
        showToast(`Achievement unlocked: ${first.name}`, "achievement", 2600);
        audio.current?.achievement();
      }
    };

    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
      last = now;
      const s = state.current;
      const w = c.clientWidth,
        h = c.clientHeight,
        dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const laneX = (lane: number) =>
        w / 2 + lane * (w * 0.075 + w * 0.415 * 0.7744) * 0.66;
      const playerY = h * 0.3 + h * 0.7 * 0.7744;

      if (s.phase === "running") {
        s.time += dt;
        s.distance += dt * runnerSpeed(s.time);
        const flying = s.fly > 0;
        for (const t of [
          "jump",
          "slide",
          "fly",
          "magnet",
          "double",
          "grace",
        ] as const)
          s[t] = Math.max(0, s[t] - dt);
        if (flying && s.fly === 0) s.grace = Math.max(s.grace, 0.8);
        s.visualLane += (s.lane - s.visualLane) * Math.min(dt * 15, 1);
        if (s.chain > 0) {
          s.chainTimer -= dt;
          if (s.chainTimer <= 0) {
            const level = multiplier(s.chain);
            s.chain = level > 1 ? (level - 2) * 8 : 0;
            s.chainTimer = level > 1 ? CHAIN_WINDOW : 0;
          }
        }
        const zi = zoneIndex(s.distance);
        if (zi !== s.zone) {
          s.zone = zi;
          s.flash = 0.6;
          const z = zones[zi % zones.length];
          showToast(`Now entering ${z.name} · ${z.sub}`, "zone", 3000);
          audio.current?.zone(z.id);
        }
        const fact = milestones[s.milestone];
        if (fact && s.distance >= fact.at) {
          s.milestone++;
          showToast(fact.text, "ahmed", 2800);
          audio.current?.ahmed(fact.text);
        }
        s.collabTimer -= dt;
        s.spawn -= dt;
        if (s.spawn <= 0) {
          const lane = Math.floor(Math.random() * 3) - 1;
          const row: Item[] =
            s.fly > 0.8
              ? (voteTrail(lane, 5) as Item[])
              : s.collabTimer <= 0
                ? (collabRow(s.collabsSpawned++) as Item[])
                : (runnerRow(
                    s.time,
                    zoneAt(s.distance),
                    Math.random,
                    s.items,
                  ) as Item[]);
          if (s.collabTimer <= 0 && s.fly <= 0.8) s.collabTimer = COLLAB_EVERY;
          s.items.push(...row);
          s.spawn = spawnGap(s.time);
        }
        const approach = approachSpeed(s.time);
        for (const item of s.items) {
          const before = item.z;
          item.z += dt * (approach + (item.kind === "bus" ? BUS_BOOST : 0));
          if (s.magnet > 0 && item.kind === "vote" && item.z > 0.5 && !item.hit)
            item.lane += (s.visualLane - item.lane) * Math.min(dt * 8, 1);
          if (item.hit || before >= 0.88 || item.z < 0.88) continue;
          item.hit = true;
          const impact = runnerCollision(item.kind, item.lane, s.visualLane, s);
          const x = laneX(item.lane),
            y = playerY - 50;
          if (impact === "collect") {
            if (item.kind === "vote") {
              const levelBefore = multiplier(s.chain);
              s.chain++;
              s.maxChain = Math.max(s.maxChain, s.chain);
              s.chainTimer = CHAIN_WINDOW;
              const gained = votePoints(s.chain, s.double > 0);
              s.points += gained;
              s.votes++;
              s.floaters.push({
                x: x + (Math.random() - 0.5) * 40,
                y: y - s.floaters.length * 14,
                text: `+${gained}`,
                life: 0.8,
                color: C.yellow,
              });
              burst(x, y, [C.green, C.yellow, "#ffffff"], 8);
              audio.current?.vote(multiplier(s.chain));
              if (multiplier(s.chain) > levelBefore)
                audio.current?.levelUp(multiplier(s.chain));
            } else if (item.kind === "collab") {
              s.collabs++;
              s.points += COLLAB_POINTS;
              s.floaters.push({
                x,
                y: y - 40,
                text: `+${COLLAB_POINTS}`,
                life: 1,
                color: "#34a853",
              });
              burst(
                x,
                y - 40,
                ["#4285f4", "#ea4335", "#fbbc04", "#34a853"],
                24,
              );
              showToast(
                `Collab unlocked: ${item.label} × Air University`,
                "collab",
              );
              audio.current?.collab(item.label || "");
            } else {
              if (item.kind === "chai") {
                s.shield = true;
                s.chai++;
                showToast(
                  "Chai shield on. Your next crash is forgiven.",
                  "power",
                );
              } else if (item.kind === "wings") {
                s.fly = FLY;
                s.flights++;
                s.jump = 0;
                s.slide = 0;
                showToast(
                  "Fazaia wings! Fly over everything for 5 s.",
                  "power",
                );
              } else if (item.kind === "magnet") {
                s.magnet = MAGNET;
                showToast(
                  "GDG magnet: votes from every lane come to you.",
                  "power",
                );
              } else if (item.kind === "double") {
                s.double = DOUBLE;
                showToast("Hackathon trophy: vote points doubled.", "power");
              }
              burst(x, y, [C.orange, C.yellow, "#ffffff"], 18);
              audio.current?.power(item.kind);
            }
          } else if (impact === "clear") {
            if (item.kind === "bar" && s.fly <= 0) s.slides++;
          } else if (impact === "crash" && s.grace <= 0) {
            if (s.shield) {
              s.shield = false;
              s.grace = 1;
              s.shake = 0.35;
              burst(x, y, [C.orange, C.red, C.yellow], 20);
              showToast("Chai shield saved you!", "power");
              audio.current?.shield();
            } else {
              s.shake = 0.5;
              setCrashTip(CRASH_TIPS[item.kind] || "");
              changePhase("over");
              audio.current?.crash();
              try {
                navigator.vibrate?.(180);
              } catch {}
              const final = runnerScore(s.distance, s.points);
              runsRef.current++;
              writeJson("campus-dash-runs", runsRef.current);
              checkAchievements(s, true);
              if (final > bestRef.current) {
                if (bestRef.current > 0) audio.current?.newBest();
                bestRef.current = final;
                setBest(final);
                writeJson("campus-dash-best", final);
              }
              if (final > boardBest.current) void endRun(s, final);
              break;
            }
          }
        }
        s.items = s.items.filter((i) => i.z < 1.15);
        if (now - hudAt > 90 || (s.phase as Phase) === "over") {
          hudAt = now;
          if ((s.phase as Phase) !== "over") checkAchievements(s);
          setHud({
            distance: Math.floor(s.distance),
            votes: s.votes,
            points: s.points,
            chain: s.chain,
            chainLeft: s.chain > 0 ? s.chainTimer / CHAIN_WINDOW : 0,
            shield: s.shield,
            fly: s.fly,
            magnet: s.magnet,
            double: s.double,
            zone: s.zone,
          });
        }
      }
      s.shake = Math.max(0, s.shake - dt);
      s.flash = Math.max(0, s.flash - dt);
      for (const p of s.sparks) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
      }
      s.sparks = s.sparks.filter((p) => p.life > 0);
      for (const f of s.floaters) {
        f.life -= dt;
        f.y -= 60 * dt;
      }
      s.floaters = s.floaters.filter((f) => f.life > 0);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene({ ctx, w, h, s, now, face, rollNumber: campaign.rollNumber });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      audio.current?.stopMusic();
      cancelAnimationFrame(frame);
      clearTimeout(toastTimer.current);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  const level = multiplier(hud.chain);
  const powers = [
    hud.shield && { id: "shield", text: "Chai shield" },
    hud.fly > 0 && { id: "wings", text: `Wings ${Math.ceil(hud.fly)}s` },
    hud.magnet > 0 && {
      id: "magnet",
      text: `Magnet ${Math.ceil(hud.magnet)}s`,
    },
    hud.double > 0 && { id: "double", text: `x2 ${Math.ceil(hud.double)}s` },
  ].filter(Boolean) as { id: string; text: string }[];

  return (
    <main className="runner-page">
      <div className="runner-patti" aria-hidden="true" />
      <div className="runner-wrap">
        <header className="runner-nav">
          <Brand />
          <nav>
            {countdown && <span className="runner-countdown">{countdown}</span>}
            <Link href="/arcade">Arcade</Link>
            <Link href="/ahmed">Meet Ahmed</Link>
          </nav>
        </header>
        <div className="runner-layout">
          <section className="runner-intro">
            <div className="runner-tags">
              <span className="tag-pink">GDGOC Air University elections</span>
              <span className="tag-green">E-9 → Kamra → Multan</span>
            </div>
            <h1>
              Dodge <mark className="hl-blue">deadlines.</mark>
              <br />
              Collect <mark className="hl-green">votes.</mark>
              <br />
              Vote <mark className="hl-red">Ahmed.</mark>
            </h1>
            <p>
              Run across every Air University campus in Ahmed’s No.{" "}
              {campaign.rollNumber} jersey: the library, the cafes, FMC, Kamra
              and Multan. It gets faster. How far can you get?
            </p>
            <Link href="/ahmed" className="runner-profile">
              <img
                src="/ahmed-face.jpg"
                width="112"
                height="112"
                alt="Ahmed Malik"
              />
              <span>
                <small>
                  Candidate for Vice President · GDGOC Air University
                </small>
                <strong>Ahmed Malik</strong>
                <span className="runner-roll">
                  Roll No. <b>{campaign.rollNumber}</b> · Vote{" "}
                  {campaign.votingLabel}
                </span>
                <span className="runner-creds">
                  <i>4× national hackathon winner</i>
                  <i>Founder, incubated at NIC Islamabad</i>
                  <i>5 internships</i>
                  <i>Technical Co-Lead, GDGOC AU</i>
                </span>
              </span>
            </Link>

            <h2 className="runner-section-title">How to play</h2>
            <ol className="runner-how">
              <li>
                <b className="key-blue">← →</b>
                <span>
                  <strong>Switch lanes</strong>Swipe sideways or arrow keys.
                </span>
              </li>
              <li>
                <b className="key-pink">↑</b>
                <span>
                  <strong>Jump pink hurdles</strong>Swipe up, ↑ or Space.
                </span>
              </li>
              <li>
                <b className="key-purple">↓</b>
                <span>
                  <strong>Slide under purple bars</strong>Swipe down or ↓.
                </span>
              </li>
              <li>
                <b className="key-indigo">!</b>
                <span>
                  <strong>Dodge blue walls &amp; AU shuttles</strong>Can’t jump
                  those. Change lanes.
                </span>
              </li>
              <li>
                <b className="key-orange">x5</b>
                <span>
                  <strong>Chain votes for x5 points</strong>Stop collecting for
                  3 s and it drops.
                </span>
              </li>
              <li>
                <b className="key-green">+300</b>
                <span>
                  <strong>Run through collab gates</strong>NUST, FAST, COMSATS
                  and more.
                </span>
              </li>
            </ol>
            <div className="runner-powers">
              <span className="pw-chai">
                <b>Chai</b> shield
              </span>
              <span className="pw-wings">
                <b>Fazaia wings</b> fly 5 s
              </span>
              <span className="pw-magnet">
                <b>GDG magnet</b> pull votes
              </span>
              <span className="pw-double">
                <b>Trophy</b> x2 points
              </span>
            </div>

            <h2 className="runner-section-title">The route</h2>
            <ol className="runner-route">
              {zones.map((z, i) => (
                <li
                  key={z.id}
                  className={best >= ZONE_LENGTH * i ? "reached" : ""}
                >
                  <b>{i * ZONE_LENGTH} m</b>
                  <span>
                    <strong>{z.name}</strong>
                    {z.sub}
                  </span>
                </li>
              ))}
            </ol>

            <h2 className="runner-section-title">
              Achievements{" "}
              <small>
                {unlocked.length}/{achievements.length}
              </small>
            </h2>
            <ul className="runner-achievements">
              {achievements.map((a) => (
                <li
                  key={a.id}
                  className={unlocked.includes(a.id) ? "got" : ""}
                  title={a.desc}
                >
                  <b>{a.badge}</b>
                  <span>
                    <strong>{a.name}</strong>
                    {a.desc}
                  </span>
                </li>
              ))}
            </ul>
            <Link className="runner-more" href="/arcade">
              Prefer something calmer? Try the other games →
            </Link>
          </section>

          <div className="runner-side">
            <Link href="/ahmed" className="runner-banner">
              <img src="/ahmed-face.jpg" width="48" height="48" alt="" />
              <span>
                <strong>Vote Ahmed Malik</strong>
                <small>
                  Roll No. {campaign.rollNumber} · VP, GDGOC AU · 21–22 Sep
                </small>
              </span>
            </Link>
            <section className="runner-machine" aria-label="Campus Dash game">
              {unsentScore > 0 && (
                <div className="runner-pending" role="status">
                  <strong>
                    {unsentScore.toLocaleString()} points waiting to upload
                  </strong>
                  <span>
                    {saveError ||
                      "Your completed run is kept on this device until the server confirms it."}
                  </span>
                  <button
                    disabled={claim === "saving"}
                    onClick={() =>
                      savedPlayer() ? void submit() : setSheet(true)
                    }
                  >
                    {claim === "saving" ? "Saving…" : "Retry saving score"}
                  </button>
                </div>
              )}
              <div className="runner-patti small" aria-hidden="true" />
              <div className="runner-hud">
                <div>
                  <small>Score</small>
                  <strong>{score.toLocaleString()}</strong>
                </div>
                <div>
                  <small>Votes</small>
                  <strong>
                    <i aria-hidden="true">✓</i> {hud.votes}
                  </strong>
                </div>
                <div className={"runner-mult level-" + level}>
                  <small>Chain</small>
                  <strong>x{level}</strong>
                  <span style={{ width: `${hud.chainLeft * 100}%` }} />
                </div>
                <button
                  className="runner-sound"
                  aria-label={muted ? "Turn sound on" : "Mute sound"}
                  aria-pressed={!muted}
                  onClick={toggleMute}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" />
                    {muted ? (
                      <path
                        d="m16 9 5 6m0-6-5 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    ) : (
                      <path
                        d="M16 8.5q2.5 3.5 0 7M18.5 6q4.5 6 0 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </button>
                <button
                  aria-label={phase === "paused" ? "Resume game" : "Pause game"}
                  disabled={phase === "ready" || phase === "over"}
                  onClick={() => {
                    changePhase(phase === "paused" ? "running" : "paused");
                    canvas.current?.focus();
                  }}
                >
                  {phase === "paused" ? "▶" : "Ⅱ"}
                </button>
              </div>
              <div
                className="runner-stage"
                onPointerDown={(e) => {
                  if (state.current.phase !== "running") return;
                  touch.current = { x: e.clientX, y: e.clientY };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (!touch.current) return;
                  const dx = e.clientX - touch.current.x,
                    dy = e.clientY - touch.current.y;
                  touch.current = null;
                  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
                  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
                  else if (dy < 0) jump();
                  else slide();
                }}
                onPointerCancel={() => {
                  touch.current = null;
                }}
              >
                <canvas
                  ref={canvas}
                  tabIndex={0}
                  aria-label="Three-lane campus runner. Left and right switch lanes, up or Space jumps, down slides, Escape pauses."
                />
                {phase === "running" && (toast || hud.distance < 120) && (
                  <div
                    className={
                      "runner-coach" + (toast ? " toast " + toast.kind : "")
                    }
                    role="status"
                  >
                    {toast?.text || "Swipe ↑ jump · ↓ slide · ← → switch lanes"}
                  </div>
                )}
                {phase === "running" && (
                  <div className="runner-status">
                    <span className="runner-zone">{zone.name}</span>
                    {powers.map((p) => (
                      <span key={p.id} className={"runner-power " + p.id}>
                        {p.text}
                      </span>
                    ))}
                  </div>
                )}
                {phase !== "running" && (
                  <div className="runner-overlay">
                    <div className={"runner-dialog " + phase}>
                      {phase === "ready" && (
                        <img
                          className="runner-face"
                          src="/ahmed-face.jpg"
                          width="64"
                          height="64"
                          alt="Ahmed Malik"
                        />
                      )}
                      <span className="runner-eyebrow">
                        {phase === "ready"
                          ? "Run with Ahmed Malik"
                          : phase === "paused"
                            ? "Chai break"
                            : runnerRank(score)}
                      </span>
                      {phase === "ready" ? (
                        <h2>
                          Campus
                          <br />
                          <em>Dash</em>
                        </h2>
                      ) : phase === "paused" ? (
                        <h2 className="small">Paused</h2>
                      ) : (
                        <strong className="runner-final">
                          {score.toLocaleString()} <small>points</small>
                        </strong>
                      )}
                      <p>
                        {phase === "ready"
                          ? "From E-9 to Multan: jump, slide, dodge shuttles and chain votes. It gets faster."
                          : phase === "paused"
                            ? "Your run is right where you left it."
                            : `${hud.distance.toLocaleString()} m · ${hud.votes} votes · reached ${zone.name}`}
                      </p>
                      {phase === "over" && newThisRun.length > 0 && (
                        <div className="runner-new-badges">
                          {newThisRun.map((id) => {
                            const a = achievements.find((x) => x.id === id)!;
                            return (
                              <span key={id}>
                                <b>{a.badge}</b> {a.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {phase === "over" &&
                        claim === "idle" &&
                        newThisRun.length === 0 && (
                          <p className="runner-tip">{crashTip}</p>
                        )}
                      {phase === "over" && claim === "ask" && (
                        <button
                          className="runner-claim"
                          onClick={() => setSheet(true)}
                        >
                          New best! Put it on the live leaderboard ↗
                        </button>
                      )}
                      {phase === "over" &&
                        claim !== "idle" &&
                        claim !== "ask" && (
                          <p
                            className={"runner-board-status " + claim}
                            role="status"
                          >
                            {claim === "saving"
                              ? "Saving to the live leaderboard…"
                              : claim === "saved"
                                ? rank?.rank
                                  ? `Saved! You’re #${rank.rank} of ${rank.total}. The public board updates within two minutes.`
                                  : "Score saved. Ranking is temporarily unavailable."
                                : saveError ||
                                  "Upload pending. Your completed run is kept on this device for retry."}
                          </p>
                        )}
                      <div className="runner-actions">
                        <button
                          className="runner-play"
                          onClick={() => {
                            if (phase === "paused") {
                              changePhase("running");
                              canvas.current?.focus();
                            } else start();
                          }}
                        >
                          {phase === "ready"
                            ? "Let’s run"
                            : phase === "paused"
                              ? "Keep running"
                              : "Run again"}{" "}
                          <span aria-hidden="true">→</span>
                        </button>
                        {phase === "over" && (
                          <a
                            className="runner-share"
                            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Challenge friends on WhatsApp
                          </a>
                        )}
                      </div>
                      {phase === "over" ? (
                        <Link href="/ahmed" className="runner-vote-line">
                          <img
                            src="/ahmed-face.jpg"
                            width="40"
                            height="40"
                            alt=""
                          />
                          <span>
                            <strong>Vote {campaign.candidateName}</strong>
                            Roll No. {campaign.rollNumber} ·{" "}
                            {campaign.votingLabel}
                          </span>
                        </Link>
                      ) : (
                        <small>
                          Swipe or arrows: ↑ jump · ↓ slide · ← → move
                        </small>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="runner-controls">
                <button aria-label="Move left" onClick={() => move(-1)}>
                  ←
                </button>
                <button className="jump" aria-label="Jump" onClick={jump}>
                  ↑ <span>Jump</span>
                </button>
                <button className="slide" aria-label="Slide" onClick={slide}>
                  ↓ <span>Slide</span>
                </button>
                <button aria-label="Move right" onClick={() => move(1)}>
                  →
                </button>
              </div>
              <div className="runner-machine-footer">
                <span>
                  Personal best <b>{best.toLocaleString()}</b>
                </span>
                <button
                  className={"runner-rot" + (brainrot ? " on" : "")}
                  aria-pressed={brainrot}
                  onClick={toggleBrainrot}
                >
                  Brainrot {brainrot ? "on" : "off"}
                </button>
                <span>
                  Achievements{" "}
                  <b>
                    {unlocked.length}/{achievements.length}
                  </b>
                </span>
              </div>
            </section>
            <LiveBoard game="dash" limit={10} refreshKey={boardKey} />
          </div>
        </div>
        <footer className="runner-campaign">
          <Link href="/ahmed" className="runner-candidate">
            <img
              src="/ahmed-face.jpg"
              width="56"
              height="56"
              alt="Ahmed Malik"
            />
            <span>
              <small>Built by a student, for students</small>
              <strong>
                Ahmed Malik <span>· Roll No. {campaign.rollNumber}</span>
              </strong>
              <span>
                For {campaign.position} · {campaign.votingLabel}
              </span>
            </span>
            <b>Meet Ahmed ↗</b>
          </Link>
          <p>
            Independent student campaign. Not an official Google, GDG or Air
            University website. Collab gates are game fun, not partnership
            claims.
          </p>
        </footer>
      </div>
      {sheet && (
        <div className="sheet-backdrop">
          <form
            className="nickname-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose your leaderboard nickname"
            onSubmit={register}
          >
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => setSheet(false)}
            >
              ×
            </button>
            <span className="section-number">
              {unsentScore.toLocaleString()} points, waiting to be saved
            </span>
            <h2>Leaderboard pe naam kya likhein?</h2>
            <label>
              Nickname
              <input
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                minLength={3}
                maxLength={16}
                placeholder="Margalla sprinter"
                required
              />
            </label>
            <label>
              Department
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {campaign.departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <p>Sirf nickname. Koi phone number, email ya roll number nahi.</p>
            {sheetError && (
              <p role="alert" className="notice">
                {sheetError}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Ek second..." : "Save my score"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
