"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { campaign } from "@/config/campaign";
import {
  runnerScore,
  runnerCollision,
  runnerRow,
  runnerRank,
  milestones,
  votingCountdown,
} from "@/lib/runner.mjs";
import LiveBoard from "./LiveBoard";
import "./runner.css";

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
function savedPlayer(): { nickname: string; department: string } | null {
  try {
    return JSON.parse(localStorage.getItem("jaago-player") || "null");
  } catch {
    return null;
  }
}

type Phase = "ready" | "running" | "paused" | "over";
type Item = {
  lane: number;
  z: number;
  kind: "vote" | "chai" | "quiz" | "deadline";
  hit?: boolean;
};
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
type Run = {
  lane: number;
  visualLane: number;
  jump: number;
  distance: number;
  votes: number;
  time: number;
  spawn: number;
  items: Item[];
  sparks: Spark[];
  shield: boolean;
  grace: number;
  milestone: number;
  phase: Phase;
};
const fresh = (): Run => ({
  lane: 0,
  visualLane: 0,
  jump: 0,
  distance: 0,
  votes: 0,
  time: 0,
  spawn: 1.6,
  items: [],
  sparks: [],
  shield: false,
  grace: 0,
  milestone: 0,
  phase: "ready",
});

// Truck-art inspired palette, shared by the canvas scene.
const C = {
  ink: "#1d2a5c",
  red: "#e4312b",
  yellow: "#ffc20e",
  green: "#1faa59",
  pakGreen: "#01411c",
  blue: "#2f6bff",
  pink: "#e6007e",
  orange: "#ff7a1a",
  cream: "#fff3d6",
};
const FLAGS = [C.red, C.yellow, C.green, C.blue, C.pink, C.orange];
const SIGNS = [
  "AHMED FOR VP",
  "E-9 CAMPUS",
  "VOTE 21-22 SEP",
  "ROLL NO. " + campaign.rollNumber,
  "GDGOC",
  "CAFE →",
];

export default function CampusRunner() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<Run>(fresh());
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState({ distance: 0, votes: 0, shield: false });
  const [best, setBest] = useState(0);
  const [crashTip, setCrashTip] = useState("");
  const [toast, setToast] = useState("");
  const [countdown, setCountdown] = useState<string | null>(null);
  const bestRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Leaderboard: each run gets a signed token; only new personal bests are submitted.
  const token = useRef<Promise<string | null>>(Promise.resolve(null));
  const pending = useRef<Record<string, unknown> | null>(null);
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
  const score = runnerScore(stats.distance, stats.votes);
  const shareText = `I scored ${score.toLocaleString()} in Campus Dash, the E-9 campus runner. Beat that: ${campaign.siteUrl}/run\n\nVote ${campaign.candidateName} (Roll No. ${campaign.rollNumber}) for ${campaign.position}, ${campaign.votingLabel}.`;

  function changePhase(next: Phase) {
    state.current.phase = next;
    setPhase(next);
  }
  function showToast(text: string) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }
  function start() {
    state.current = fresh();
    setStats({ distance: 0, votes: 0, shield: false });
    setToast("");
    setClaim("idle");
    setRank(null);
    pending.current = null;
    token.current = post("session/start", { mode: "dash" })
      .then((d) => d.token as string)
      .catch(() => null);
    changePhase("running");
    canvas.current?.focus();
  }
  async function submit(retried = false): Promise<void> {
    const body = pending.current;
    if (!body) return;
    setClaim("saving");
    try {
      const saved = await post("score", body);
      pending.current = null;
      boardBest.current = Math.max(boardBest.current, Number(body.score));
      try {
        localStorage.setItem(
          "campus-dash-board-best",
          String(boardBest.current),
        );
      } catch {}
      setRank(saved);
      setClaim("saved");
      setBoardKey((k) => k + 1);
    } catch (e) {
      const player = savedPlayer();
      // The player cookie can expire while the nickname is still on this device.
      if (!retried && player && /nickname|player/i.test((e as Error).message)) {
        try {
          await post("player", player);
          return submit(true);
        } catch {}
      }
      setClaim("failed");
    }
  }
  async function endRun(
    final: number,
    votes: number,
    distance: number,
    seconds: number,
  ) {
    const runToken = await token.current;
    if (!runToken || final <= 0) return;
    pending.current = {
      token: runToken,
      mode: "dash",
      score: final,
      votes,
      distance: Math.floor(distance),
      durationMs: Math.round(seconds * 1000),
    };
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
      try {
        localStorage.setItem("jaago-player", JSON.stringify(player));
      } catch {}
      setSheet(false);
      await submit();
    } catch (err) {
      setSheetError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(direction: number) {
    const s = state.current;
    if (s.phase === "running")
      s.lane = Math.max(-1, Math.min(1, s.lane + direction));
  }
  function jump() {
    const s = state.current;
    if (s.phase === "running" && s.jump <= 0) s.jump = 0.85;
  }

  useEffect(() => {
    setCountdown(
      votingCountdown(Date.now(), campaign.votingDate, campaign.votingEndDate),
    );
    try {
      const saved = Number(localStorage.getItem("campus-dash-best"));
      if (Number.isFinite(saved) && saved > 0) {
        bestRef.current = saved;
        setBest(saved);
      }
      boardBest.current =
        Number(localStorage.getItem("campus-dash-board-best")) || 0;
    } catch {}
    const key = (e: KeyboardEvent) => {
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          " ",
          "a",
          "d",
          "w",
          "Escape",
        ].includes(e.key)
      ) {
        if ((e.target as HTMLElement)?.closest("a,button,input,select,form"))
          return;
        e.preventDefault();
        if (e.key === "Escape") {
          if (state.current.phase === "running") changePhase("paused");
          else if (state.current.phase === "paused") changePhase("running");
        } else if (e.key === "ArrowLeft" || e.key === "a") move(-1);
        else if (e.key === "ArrowRight" || e.key === "d") move(1);
        else if (!e.repeat) jump();
      }
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
      hud = 0;
    const box = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: string,
    ) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };
    const circle = (x: number, y: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const burst = (x: number, y: number, colors: string[]) => {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
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
      const horizon = h * 0.3,
        roadTop = w * 0.075,
        roadBottom = w * 0.49;
      const point = (lane: number, z: number) => {
        const p = z * z;
        return {
          x: w / 2 + lane * (roadTop + (roadBottom - roadTop) * p) * 0.66,
          y: horizon + (h - horizon) * p,
          scale: 0.15 + p * 1.3,
        };
      };

      if (s.phase === "running") {
        s.time += dt;
        s.distance += dt * (18 + Math.min(s.time * 0.15, 16));
        s.jump = Math.max(0, s.jump - dt);
        s.grace = Math.max(0, s.grace - dt);
        s.visualLane += (s.lane - s.visualLane) * Math.min(dt * 15, 1);
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.items.push(...(runnerRow(s.time) as Item[]));
          s.spawn = Math.max(0.85, 1.55 - s.time / 150);
        }
        const next = milestones[s.milestone];
        if (next && s.distance >= next.at) {
          s.milestone++;
          showToast(next.text);
        }
        const speed = 0.25 + Math.min(s.time / 260, 0.2);
        for (const item of s.items) {
          const before = item.z;
          item.z += dt * speed;
          if (item.hit || before >= 0.88 || item.z < 0.88) continue;
          item.hit = true;
          const impact = runnerCollision(
            item.kind,
            item.lane,
            s.visualLane,
            s.jump,
          );
          const at = point(item.lane, 0.88);
          if (impact === "collect" && item.kind === "vote") {
            s.votes++;
            burst(at.x, at.y - 30, [C.green, C.yellow, "#ffffff"]);
          } else if (impact === "collect") {
            s.shield = true;
            burst(at.x, at.y - 30, [C.orange, C.yellow, C.cream]);
            showToast("Chai shield on. Your next crash is forgiven.");
          } else if (impact === "crash" && (s.shield || s.grace > 0)) {
            if (s.grace <= 0) {
              s.shield = false;
              s.grace = 0.8;
              showToast("Chai shield saved you!");
            }
            burst(at.x, at.y - 30, [C.orange, C.red, C.yellow]);
          } else if (impact === "crash") {
            setCrashTip(
              item.kind === "deadline"
                ? "Blue DEADLINE walls are too tall to jump. Switch lanes instead."
                : "Jump just before a pink QUIZ hurdle reaches you, or switch lanes.",
            );
            changePhase("over");
            const final = runnerScore(s.distance, s.votes);
            if (final > bestRef.current) {
              bestRef.current = final;
              setBest(final);
              try {
                localStorage.setItem("campus-dash-best", String(final));
              } catch {}
            }
            if (final > boardBest.current)
              void endRun(final, s.votes, s.distance, s.time);
            break;
          }
        }
        s.items = s.items.filter((i) => i.z < 1.15);
        if (now - hud > 80 || (s.phase as Phase) === "over") {
          setStats({
            distance: Math.floor(s.distance),
            votes: s.votes,
            shield: s.shield,
          });
          hud = now;
        }
      }
      for (const p of s.sparks) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
      }
      s.sparks = s.sparks.filter((p) => p.life > 0);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Islamabad daytime sky.
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#2fa8ec");
      sky.addColorStop(0.7, "#8fd8fb");
      sky.addColorStop(1, "#ffe6ad");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon + 2);
      circle(w * 0.82, h * 0.09, w * 0.075, "#ffe98a");
      circle(w * 0.82, h * 0.09, w * 0.055, C.yellow);
      for (let i = 0; i < 4; i++) {
        const x = ((i * 0.31 + now / 90000) % 1.3) * w - w * 0.15,
          y = h * (0.05 + (i % 2) * 0.06),
          r = w * 0.03;
        circle(x, y, r, "#ffffffdd");
        circle(x + r, y - r * 0.5, r * 1.2, "#ffffffdd");
        circle(x + r * 2.2, y, r, "#ffffffdd");
      }
      // A PAF jet flies over every 16 seconds.
      const pass = (now / 16000) % 1;
      if (pass < 0.3) {
        const t = pass / 0.3,
          jx = -60 + t * (w + 120),
          jy = h * 0.2 - t * h * 0.1,
          js = w / 400;
        ctx.strokeStyle = "#ffffffcc";
        ctx.lineWidth = 3 * js;
        ctx.beginPath();
        ctx.moveTo(jx - 150 * js, jy + 38 * js);
        ctx.lineTo(jx - 12 * js, jy + 3 * js);
        ctx.stroke();
        ctx.fillStyle = "#5b6b86";
        ctx.beginPath();
        ctx.moveTo(jx + 16 * js, jy - 4 * js);
        ctx.lineTo(jx - 12 * js, jy + 2 * js);
        ctx.lineTo(jx - 16 * js, jy - 6 * js);
        ctx.lineTo(jx - 8 * js, jy - 3 * js);
        ctx.lineTo(jx - 2 * js, jy - 12 * js);
        ctx.lineTo(jx + 3 * js, jy - 4 * js);
        ctx.closePath();
        ctx.fill();
      }
      // Margalla Hills, far and near ridges.
      const ridge = (
        base: number,
        amp: (x: number) => number,
        fill: string,
      ) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(0, horizon + 2);
        for (let x = 0; x <= w + 8; x += 8)
          ctx.lineTo(x, base - amp((x / w) * 400));
        ctx.lineTo(w, horizon + 2);
        ctx.closePath();
        ctx.fill();
      };
      ridge(
        horizon,
        (x) =>
          h *
          (0.17 + 0.05 * Math.sin(x * 0.011) + 0.025 * Math.sin(x * 0.033 + 1)),
        "#86bfa6",
      );
      ridge(
        horizon,
        (x) =>
          h *
          (0.08 + 0.03 * Math.sin(x * 0.019 + 2) + 0.012 * Math.sin(x * 0.06)),
        "#3a9a62",
      );
      // Faisal Mosque at the foot of the hills.
      const mx = w * 0.24,
        my = horizon,
        mw = w * 0.13,
        mh = h * 0.07;
      ctx.fillStyle = "#fbf8ff";
      ctx.beginPath();
      ctx.moveTo(mx - mw / 2, my);
      ctx.lineTo(mx, my - mh);
      ctx.lineTo(mx + mw / 2, my);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d8d0ee";
      ctx.beginPath();
      ctx.moveTo(mx, my - mh);
      ctx.lineTo(mx + mw / 2, my);
      ctx.lineTo(mx, my);
      ctx.closePath();
      ctx.fill();
      for (const side of [-1, 1]) {
        box(
          mx + side * mw * 0.78 - 1.5,
          my - mh * 1.7,
          3,
          mh * 1.7,
          1,
          "#fbf8ff",
        );
        ctx.fillStyle = "#fbf8ff";
        ctx.beginPath();
        ctx.moveTo(mx + side * mw * 0.78 - 2, my - mh * 1.7);
        ctx.lineTo(mx + side * mw * 0.78, my - mh * 2.05);
        ctx.lineTo(mx + side * mw * 0.78 + 2, my - mh * 1.7);
        ctx.fill();
      }
      // Campus blocks and the national flag on the right.
      const blocks = [
        ["#e2694a", 0.05],
        [C.cream, 0.075],
        ["#f39a3d", 0.06],
        [C.cream, 0.085],
        ["#e2694a", 0.055],
      ] as const;
      blocks.forEach(([fill, bh], i) => {
        const bx = w * (0.56 + i * 0.09),
          bw = w * 0.1,
          top = horizon - h * bh;
        box(bx, top, bw, h * bh + 2, 2, fill);
        ctx.fillStyle = fill === C.cream ? "#2f6bff99" : "#fff3d6aa";
        for (let r = 0; r < 2; r++)
          for (let k = 0; k < 3; k++)
            ctx.fillRect(
              bx + bw * (0.15 + k * 0.28),
              top + h * (0.012 + r * 0.02),
              bw * 0.14,
              h * 0.01,
            );
      });
      const fx = w * 0.53,
        fy = horizon - h * 0.12;
      ctx.fillStyle = "#8a8f9e";
      ctx.fillRect(fx, fy, 2, h * 0.12);
      box(fx + 2, fy, w * 0.055, h * 0.032, 1, C.pakGreen);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(fx + 2, fy, w * 0.014, h * 0.032);
      circle(fx + 2 + w * 0.034, fy + h * 0.016, h * 0.009, "#ffffff");
      circle(fx + 2 + w * 0.037, fy + h * 0.014, h * 0.008, C.pakGreen);

      // Grass bands give a sense of speed.
      ctx.fillStyle = "#5cc46b";
      ctx.fillRect(0, horizon, w, h - horizon);
      for (let i = 0; i < 14; i += 2) {
        const z0 = (i / 14 + s.distance / 160) % 1,
          z1 = Math.min(z0 + 1 / 14, 1);
        const y0 = point(0, z0).y,
          y1 = point(0, z1).y;
        ctx.fillStyle = "#4db55f";
        ctx.fillRect(0, y0, w, y1 - y0);
      }
      // Road.
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTop, horizon);
      ctx.lineTo(w / 2 + roadTop, horizon);
      ctx.lineTo(w / 2 + roadBottom, h);
      ctx.lineTo(w / 2 - roadBottom, h);
      ctx.closePath();
      ctx.fillStyle = "#4a4468";
      ctx.fill();
      // Black-and-yellow kerbs, like every road in the city.
      for (let i = 0; i < 24; i++) {
        const z0 = (i / 24 + s.distance / 180) % 1,
          z1 = Math.min(z0 + 1 / 24, 1);
        ctx.fillStyle = i % 2 ? "#23202f" : C.yellow;
        for (const side of [-1, 1]) {
          const a = point(side * 1.5, z0),
            b = point(side * 1.5, z1),
            c2 = point(side * 1.64, z1),
            d = point(side * 1.64, z0);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c2.x, c2.y);
          ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fill();
        }
      }
      for (let i = 0; i < 16; i++) {
        const z = (i / 16 + s.distance / 180) % 1;
        for (const lane of [-0.5, 0.5]) {
          const a = point(lane, z),
            b = point(lane, Math.min(z + 0.02, 1));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = "#ffffffcc";
          ctx.lineWidth = 1 + z * 4;
          ctx.stroke();
        }
      }

      // Roadside scenery, far to near.
      type Prop = { z: number; draw: () => void };
      const props: Prop[] = [];
      for (let i = 0; i < 8; i++) {
        const z = (i / 8 + s.distance / 220) % 1;
        for (const side of [-1, 1]) {
          props.push({
            z,
            draw: () => {
              const p = point(side * 2.05, z);
              box(
                p.x - 2 * p.scale,
                p.y - 55 * p.scale,
                5 * p.scale,
                55 * p.scale,
                1,
                "#7a4b2a",
              );
              const leaf =
                (i + (side > 0 ? 1 : 0)) % 4 === 0
                  ? "#ff8fbf"
                  : i % 2
                    ? "#2e9e5b"
                    : "#3fb86a";
              circle(p.x, p.y - 62 * p.scale, 20 * p.scale, leaf);
              circle(
                p.x - 11 * p.scale,
                p.y - 52 * p.scale,
                13 * p.scale,
                leaf,
              );
              circle(
                p.x + 11 * p.scale,
                p.y - 52 * p.scale,
                13 * p.scale,
                leaf,
              );
            },
          });
        }
      }
      for (let i = 0; i < 3; i++) {
        const phase = i / 3 + s.distance / 420,
          z = phase % 1,
          text =
            SIGNS[
              (((i - Math.floor(phase)) % SIGNS.length) + SIGNS.length) %
                SIGNS.length
            ],
          side = i % 2 ? 1 : -1;
        props.push({
          z,
          draw: () => {
            const p = point(side * 2.7, z);
            if (p.scale < 0.2) return;
            const sw = 78 * p.scale,
              sh = 22 * p.scale;
            box(
              p.x - 1.5 * p.scale,
              p.y - 60 * p.scale,
              3 * p.scale,
              60 * p.scale,
              1,
              "#8a8f9e",
            );
            box(
              p.x - sw / 2,
              p.y - 70 * p.scale,
              sw,
              sh,
              3 * p.scale,
              "#0b7a3e",
            );
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = Math.max(1, 1.5 * p.scale);
            ctx.beginPath();
            ctx.roundRect(
              p.x - sw / 2 + 2 * p.scale,
              p.y - 68 * p.scale,
              sw - 4 * p.scale,
              sh - 4 * p.scale,
              2 * p.scale,
            );
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = `800 ${8.5 * p.scale}px Rubik, Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, p.x, p.y - 59 * p.scale, sw - 8 * p.scale);
          },
        });
      }
      // Jhandiyan (flag bunting) strung across the road.
      for (let i = 0; i < 2; i++) {
        const z = (i / 2 + s.distance / 300) % 1;
        props.push({
          z,
          draw: () => {
            if (z < 0.08) return;
            const l = point(-1.75, z),
              r = point(1.75, z),
              top = 95 * l.scale;
            ctx.fillStyle = "#6b6f80";
            ctx.fillRect(l.x - 1.5 * l.scale, l.y - top, 3 * l.scale, top);
            ctx.fillRect(r.x - 1.5 * r.scale, r.y - top, 3 * r.scale, top);
            const n = 11,
              sag = 18 * l.scale;
            for (let k = 0; k < n; k++) {
              const t0 = k / n,
                t1 = (k + 1) / n,
                x0 = l.x + (r.x - l.x) * t0,
                x1 = l.x + (r.x - l.x) * t1,
                y0 = l.y - top + Math.sin(t0 * Math.PI) * sag,
                y1 = l.y - top + Math.sin(t1 * Math.PI) * sag;
              ctx.fillStyle = FLAGS[k % FLAGS.length];
              ctx.beginPath();
              ctx.moveTo(x0, y0);
              ctx.lineTo(x1, y1);
              ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2 + 14 * l.scale);
              ctx.closePath();
              ctx.fill();
            }
            if (l.scale < 0.3) return;
            const pw = 104 * l.scale,
              ph = 20 * l.scale,
              panelY = l.y - top + sag + 4 * l.scale;
            box((l.x + r.x) / 2 - pw / 2, panelY, pw, ph, 3 * l.scale, C.red);
            ctx.fillStyle = "#ffffff";
            ctx.font = `800 ${9 * l.scale}px Rubik, Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              "VOTE AHMED MALIK",
              (l.x + r.x) / 2,
              panelY + ph / 2,
              pw - 6,
            );
          },
        });
      }
      // Election billboards with Ahmed's photo, like every campaign season.
      for (let i = 0; i < 2; i++) {
        const z = (i / 2 + 0.25 + s.distance / 520) % 1,
          side = i % 2 ? -1 : 1;
        props.push({
          z,
          draw: () => {
            const p = point(side * 1.95, z),
              k = p.scale * 1.2;
            if (p.scale < 0.22) return;
            const bw = 132 * k,
              bh = 62 * k,
              bx = side > 0 ? p.x : p.x - bw,
              by = p.y - 50 * k - bh;
            ctx.fillStyle = "#6b6f80";
            ctx.fillRect(bx + bw * 0.2, by + bh, 3 * k, 50 * k);
            ctx.fillRect(bx + bw * 0.78, by + bh, 3 * k, 50 * k);
            box(bx - 3 * k, by - 3 * k, bw + 6 * k, bh + 6 * k, 4 * k, C.ink);
            box(bx, by, bw, bh, 3 * k, C.yellow);
            const ps = bh - 8 * k;
            if (face.complete && face.naturalWidth) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(bx + 4 * k, by + 4 * k, ps, ps, 3 * k);
              ctx.clip();
              ctx.drawImage(face, bx + 4 * k, by + 4 * k, ps, ps);
              ctx.restore();
            } else box(bx + 4 * k, by + 4 * k, ps, ps, 3 * k, C.pink);
            const tx = bx + ps + 10 * k,
              tw = bw - ps - 14 * k;
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = C.ink;
            ctx.font = `900 ${11.5 * k}px Rubik, Arial, sans-serif`;
            ctx.fillText("AHMED", tx, by + 15 * k, tw);
            ctx.fillText("MALIK", tx, by + 27 * k, tw);
            ctx.font = `700 ${6.3 * k}px Rubik, Arial, sans-serif`;
            ctx.fillText("VP · GDGOC AIR UNI", tx, by + 36 * k, tw);
            ctx.fillStyle = C.red;
            ctx.fillText(
              "ROLL NO. " + campaign.rollNumber,
              tx,
              by + 44 * k,
              tw,
            );
            box(tx - 1 * k, by + 48 * k, tw + 2 * k, 10 * k, 2 * k, C.green);
            ctx.fillStyle = "#ffffff";
            ctx.font = `800 ${6.3 * k}px Rubik, Arial, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("VOTE 21-22 SEP", tx + tw / 2, by + 53 * k, tw);
          },
        });
      }
      for (const item of s.items) {
        if (item.hit && (item.kind === "vote" || item.kind === "chai"))
          continue;
        props.push({ z: item.z, draw: () => drawItem(item) });
      }
      const drawItem = (item: Item) => {
        const p = point(item.lane, item.z),
          u = Math.min(w * 0.115, 56) * p.scale;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (item.kind === "vote") {
          const y = p.y - u * 0.75 + Math.sin(now / 220 + item.lane) * u * 0.08;
          circle(p.x, y, u * 0.48, "#ffc20e55");
          ctx.save();
          ctx.translate(p.x, y);
          ctx.rotate(-0.14);
          box(-u * 0.27, -u * 0.34, u * 0.54, u * 0.68, u * 0.06, "#ffffff");
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = Math.max(1, u * 0.05);
          ctx.strokeRect(-u * 0.27, -u * 0.34, u * 0.54, u * 0.68);
          ctx.strokeStyle = C.green;
          ctx.lineWidth = Math.max(1.5, u * 0.1);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(-u * 0.14, 0);
          ctx.lineTo(-u * 0.03, u * 0.12);
          ctx.lineTo(u * 0.16, -u * 0.14);
          ctx.stroke();
          ctx.restore();
        } else if (item.kind === "chai") {
          const y = p.y - u * 0.7 + Math.sin(now / 200) * u * 0.06;
          circle(p.x, y, u * 0.5, "#ff7a1a44");
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = Math.max(1, u * 0.06);
          ctx.beginPath();
          ctx.arc(p.x + u * 0.22, y + u * 0.02, u * 0.12, -1.2, 1.2);
          ctx.stroke();
          ctx.fillStyle = C.orange;
          ctx.beginPath();
          ctx.moveTo(p.x - u * 0.26, y - u * 0.16);
          ctx.lineTo(p.x + u * 0.26, y - u * 0.16);
          ctx.lineTo(p.x + u * 0.19, y + u * 0.24);
          ctx.lineTo(p.x - u * 0.19, y + u * 0.24);
          ctx.closePath();
          ctx.fill();
          box(
            p.x - u * 0.29,
            y - u * 0.2,
            u * 0.58,
            u * 0.08,
            u * 0.03,
            C.cream,
          );
          ctx.strokeStyle = "#ffffffcc";
          for (const dx of [-0.1, 0.08]) {
            ctx.beginPath();
            ctx.moveTo(p.x + u * dx, y - u * 0.28);
            ctx.quadraticCurveTo(
              p.x + u * (dx + 0.08),
              y - u * 0.4,
              p.x + u * dx,
              y - u * 0.52,
            );
            ctx.stroke();
          }
        } else if (item.kind === "quiz") {
          box(p.x - u * 0.5, p.y - u * 0.7, u * 0.07, u * 0.7, 1, C.ink);
          box(p.x + u * 0.43, p.y - u * 0.7, u * 0.07, u * 0.7, 1, C.ink);
          box(
            p.x - u * 0.58,
            p.y - u * 0.78,
            u * 1.16,
            u * 0.46,
            u * 0.08,
            C.pink,
          );
          box(
            p.x - u * 0.58,
            p.y - u * 0.78,
            u * 1.16,
            u * 0.09,
            u * 0.04,
            C.yellow,
          );
          ctx.fillStyle = "#ffffff";
          ctx.font = `800 ${u * 0.26}px Rubik, Arial, sans-serif`;
          ctx.fillText("QUIZ", p.x, p.y - u * 0.52);
        } else {
          box(
            p.x - u * 0.55,
            p.y - u * 1.65,
            u * 1.1,
            u * 1.65,
            u * 0.08,
            C.blue,
          );
          ctx.fillStyle = "#1f4fd6";
          for (let k = 0; k < 3; k++)
            ctx.fillRect(
              p.x - u * 0.55,
              p.y - u * (0.32 + k * 0.3),
              u * 1.1,
              u * 0.06,
            );
          circle(p.x, p.y - u * 1.3, u * 0.22, "#ffffff");
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = Math.max(1, u * 0.05);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - u * 1.42);
          ctx.lineTo(p.x, p.y - u * 1.3);
          ctx.lineTo(p.x + u * 0.1, p.y - u * 1.25);
          ctx.stroke();
          ctx.fillStyle = C.yellow;
          ctx.font = `800 ${u * 0.19}px Rubik, Arial, sans-serif`;
          ctx.fillText("DEADLINE", p.x, p.y - u * 0.92, u * 1);
        }
      };
      props
        .sort((a, b) => a.z - b.z)
        .forEach((prop) => {
          if (prop.z < 0.88) prop.draw();
        });

      // The student: seen from behind, GDG-badged backpack and all.
      const player = point(s.visualLane, 0.88),
        u = Math.min(w * 0.08, 36),
        air = Math.sin((s.jump / 0.85) * Math.PI) * h * 0.17;
      ctx.fillStyle = "#0003";
      ctx.beginPath();
      ctx.ellipse(
        player.x,
        player.y + 5,
        u * 0.9 * (1 - air / h),
        u * 0.24,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      const moving = s.phase === "running" && !s.jump;
      const bob = moving ? Math.sin(s.time * 22) * 3 : 0,
        py = player.y - air + bob,
        stride = moving ? Math.sin(s.time * 18) * u * 0.22 : 0;
      if (!(s.grace > 0 && Math.floor(now / 80) % 2)) {
        box(
          player.x - u * 0.46,
          py - u * 0.62 + stride,
          u * 0.36,
          u * 0.66,
          5,
          "#2b3a78",
        );
        box(
          player.x + u * 0.1,
          py - u * 0.62 - stride,
          u * 0.36,
          u * 0.66,
          5,
          "#2b3a78",
        );
        box(
          player.x - u * 0.5,
          py - u * 0.06 + stride,
          u * 0.42,
          u * 0.18,
          4,
          "#ffffff",
        );
        box(
          player.x + u * 0.08,
          py - u * 0.06 - stride,
          u * 0.42,
          u * 0.18,
          4,
          "#ffffff",
        );
        // Ahmed's jersey: name across the back, roll number as the shirt number.
        box(
          player.x - u * 0.95,
          py - u * 1.78,
          u * 0.3,
          u * 0.9,
          u * 0.14,
          "#b87a4e",
        );
        box(
          player.x + u * 0.65,
          py - u * 1.78,
          u * 0.3,
          u * 0.9,
          u * 0.14,
          "#b87a4e",
        );
        box(
          player.x - u * 0.78,
          py - u * 1.86,
          u * 1.56,
          u * 1.42,
          u * 0.3,
          "#0f8a3f",
        );
        box(
          player.x - u * 0.78,
          py - u * 0.62,
          u * 1.56,
          u * 0.16,
          3,
          C.yellow,
        );
        ctx.fillStyle = C.yellow;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${u * 0.34}px Rubik, Arial, sans-serif`;
        ctx.fillText("AHMED", player.x, py - u * 1.56, u * 1.4);
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${u * 0.36}px Rubik, Arial, sans-serif`;
        ctx.fillText(campaign.rollNumber, player.x, py - u * 1.08, u * 1.4);
        box(player.x - u * 0.2, py - u * 2.06, u * 0.4, u * 0.25, 4, "#b87a4e");
        box(
          player.x - u * 0.47,
          py - u * 2.68,
          u * 0.94,
          u * 0.76,
          u * 0.36,
          "#141414",
        );
        box(player.x - u * 0.52, py - u * 2.28, u * 0.1, u * 0.2, 2, "#b87a4e");
        box(player.x + u * 0.42, py - u * 2.28, u * 0.1, u * 0.2, 2, "#b87a4e");
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = Math.max(1, u * 0.06);
        ctx.beginPath();
        ctx.moveTo(player.x - u * 0.5, py - u * 2.3);
        ctx.lineTo(player.x + u * 0.5, py - u * 2.3);
        ctx.stroke();
        if (s.phase !== "running" || s.time < 3) {
          const label = `AHMED MALIK · ${campaign.rollNumber}`;
          ctx.font = `800 ${Math.max(10, u * 0.36)}px Rubik, Arial, sans-serif`;
          const lw = ctx.measureText(label).width + 16;
          box(player.x - lw / 2, py - u * 3.5, lw, u * 0.62, 999, C.ink);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, player.x, py - u * 3.19);
        }
      }
      if (s.shield) {
        ctx.strokeStyle = `rgba(255,122,26,${0.55 + Math.sin(now / 120) * 0.25})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(
          player.x,
          py - u * 1.2,
          u * 1.25,
          u * 1.75,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      props.forEach((prop) => {
        if (prop.z >= 0.88) prop.draw();
      });
      for (const p of s.sparks) {
        ctx.globalAlpha = Math.min(1, p.life / 0.3);
        box(p.x - 3, p.y - 3, 6, 6, 1, p.color);
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(toastTimer.current);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  return (
    <main className="runner-page">
      <div className="runner-patti" aria-hidden="true" />
      <div className="runner-wrap">
        <header className="runner-nav">
          <Link href="/" className="brand">
            <span className="brand-flower">✳</span> jaago
            <span className="brand-dot">.</span>
          </Link>
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
              <span className="tag-green">E-9, Islamabad</span>
            </div>
            <h1>
              Dodge <mark className="hl-blue">deadlines.</mark>
              <br />
              Collect <mark className="hl-green">votes.</mark>
              <br />
              Vote <mark className="hl-red">Ahmed.</mark>
            </h1>
            <p>
              Run the E-9 campus in Ahmed’s No. {campaign.rollNumber} jersey,
              past his campaign billboards and the Margallas. No sign-up, just
              one more try.
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
            <ol className="runner-how">
              <li>
                <b className="key-blue">← →</b>
                <span>
                  <strong>Switch lanes</strong>Swipe sideways or use the arrow
                  keys.
                </span>
              </li>
              <li>
                <b className="key-pink">↑</b>
                <span>
                  <strong>Jump the pink QUIZ hurdles</strong>Swipe up or press
                  Space.
                </span>
              </li>
              <li>
                <b className="key-indigo">⏰</b>
                <span>
                  <strong>Dodge blue DEADLINE walls</strong>Too tall to jump.
                  Change lanes.
                </span>
              </li>
              <li>
                <b className="key-orange">☕</b>
                <span>
                  <strong>Grab chai for a shield</strong>It forgives your next
                  crash.
                </span>
              </li>
            </ol>
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
              <div className="runner-patti small" aria-hidden="true" />
              <div className="runner-hud">
                <div>
                  <small>Score</small>
                  <strong>{score.toLocaleString()}</strong>
                </div>
                <div>
                  <small>Votes</small>
                  <strong>
                    <i aria-hidden="true">✓</i> {stats.votes}
                  </strong>
                </div>
                {stats.shield && (
                  <span className="runner-shield">☕ Shield</span>
                )}
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
                }}
                onPointerCancel={() => {
                  touch.current = null;
                }}
              >
                <canvas
                  ref={canvas}
                  tabIndex={0}
                  aria-label="Three-lane campus runner. Left and right arrows switch lanes. Space or up arrow jumps. Escape pauses."
                />
                {phase === "running" && (toast || stats.distance < 85) && (
                  <div
                    className={"runner-coach" + (toast ? " toast" : "")}
                    role="status"
                  >
                    {toast || "Collect the ✓ votes · Switch lanes with ← →"}
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
                          ? `Wear his No. ${campaign.rollNumber} jersey. Collect votes, jump quizzes, dodge deadlines.`
                          : phase === "paused"
                            ? "Your run is right where you left it."
                            : `${stats.distance} m · ${stats.votes} votes · best ${best.toLocaleString()}`}
                      </p>
                      {phase === "over" && claim === "idle" && (
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
                              : claim === "saved" && rank
                                ? `You’re #${rank.rank} of ${rank.total} on the live leaderboard!`
                                : "Couldn’t reach the leaderboard. Your best is saved on this device."}
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
                            Share on WhatsApp
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
                        <small>Swipe or ← → to move · ↑ / Space to jump</small>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="runner-controls">
                <button aria-label="Move left" onClick={() => move(-1)}>
                  ← <span>Left</span>
                </button>
                <button className="jump" aria-label="Jump" onClick={jump}>
                  ↑ <span>Jump</span>
                </button>
                <button aria-label="Move right" onClick={() => move(1)}>
                  <span>Right</span> →
                </button>
              </div>
              <div className="runner-machine-footer">
                <span>
                  Personal best <b>{best.toLocaleString()}</b>
                </span>
                <span>1 vote = 25 points</span>
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
            University website.
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
              {score.toLocaleString()} points, waiting to be saved
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
