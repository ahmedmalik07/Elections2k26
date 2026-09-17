"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { campaign } from "@/config/campaign";
import { runnerScore, runnerCollision, runnerRow } from "@/lib/runner.mjs";
import "./runner.css";

type Phase = "ready" | "running" | "paused" | "over";
type Item = {
  lane: number;
  z: number;
  kind: "coin" | "barrier" | "block";
  hit?: boolean;
};
type Run = {
  lane: number;
  visualLane: number;
  jump: number;
  distance: number;
  coins: number;
  time: number;
  spawn: number;
  items: Item[];
  phase: Phase;
};
const fresh = (): Run => ({
  lane: 0,
  visualLane: 0,
  jump: 0,
  distance: 0,
  coins: 0,
  time: 0,
  spawn: 1.6,
  items: [],
  phase: "ready",
});
export default function CampusRunner() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<Run>(fresh());
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState({ distance: 0, coins: 0 });
  const [best, setBest] = useState(0);
  const [crashTip, setCrashTip] = useState("");
  const bestRef = useRef(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const score = runnerScore(stats.distance, stats.coins);
  function changePhase(next: Phase) {
    state.current.phase = next;
    setPhase(next);
  }
  function start() {
    state.current = fresh();
    setStats({ distance: 0, coins: 0 });
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
    if (s.phase === "running" && s.jump <= 0) s.jump = 0.85;
  }
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("campus-dash-best"));
      if (Number.isFinite(saved) && saved > 0) {
        bestRef.current = saved;
        setBest(saved);
      }
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
        if ((e.target as HTMLElement)?.closest("a,button,input")) return;
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
    let frame = 0,
      last = 0,
      hud = 0;
    const roundRect = (
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
    const draw = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
      last = now;
      const s = state.current;
      if (s.phase === "running") {
        s.time += dt;
        s.distance += dt * (18 + Math.min(s.time * 0.15, 16));
        s.jump = Math.max(0, s.jump - dt);
        s.visualLane += (s.lane - s.visualLane) * Math.min(dt * 15, 1);
        s.spawn -= dt;
        if (s.spawn <= 0) {
          s.items.push(...(runnerRow(s.time) as Item[]));
          s.spawn = Math.max(0.85, 1.55 - s.time / 150);
        }
        const speed = 0.25 + Math.min(s.time / 260, 0.2);
        for (const item of s.items) {
          const before = item.z;
          item.z += dt * speed;
          if (!item.hit && before < 0.88 && item.z >= 0.88) {
            item.hit = true;
            const impact = runnerCollision(item.kind, item.lane, s.visualLane, s.jump);
            if (impact !== "miss") {
              if (impact === "collect") s.coins++;
              else if (impact === "crash") {
                setCrashTip(item.kind === "block" ? "Purple blocks are too tall to jump. Switch lanes to dodge them." : "Jump a little before an orange barrier reaches your feet — or switch lanes.");
                s.phase = "over";
                setPhase("over");
                const final = runnerScore(s.distance, s.coins);
                if (final > bestRef.current) {
                  bestRef.current = final;
                  setBest(final);
                  try {
                    localStorage.setItem("campus-dash-best", String(final));
                  } catch {}
                }
                break;
              }
            }
          }
        }
        s.items = s.items.filter((i) => i.z < 1.15);
        if (now - hud > 80 || s.phase === "over") {
          setStats({ distance: Math.floor(s.distance), coins: s.coins });
          hud = now;
        }
      }
      const w = c.clientWidth,
        h = c.clientHeight,
        dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const horizon = h * 0.27,
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
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#152340");
      sky.addColorStop(0.55, "#465783");
      sky.addColorStop(1, "#b39494");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffda9a";
      ctx.beginPath();
      ctx.arc(w * 0.76, h * 0.16, w * 0.065, 0, Math.PI * 2);
      ctx.fill();
      // Campus skyline and warm classroom windows.
      for (let i = 0; i < 12; i++) {
        const bw = w / 10,
          bh = h * (0.05 + ((i * 7) % 5) * 0.017),
          x = (i * w) / 11;
        roundRect(
          x,
          horizon - bh,
          bw,
          bh + 25,
          2,
          i % 2 ? "#253552" : "#1c2b48",
        );
        ctx.fillStyle = "#ffcf8466";
        for (let j = 0; j < 3; j++)
          ctx.fillRect(x + 7 + (j * bw) / 4, horizon - bh + 12, 4, 7);
      }
      ctx.fillStyle = "#225450";
      ctx.fillRect(0, horizon + 12, w, h);
      ctx.beginPath();
      ctx.moveTo(w / 2 - roadTop, horizon);
      ctx.lineTo(w / 2 + roadTop, horizon);
      ctx.lineTo(w / 2 + roadBottom, h);
      ctx.lineTo(w / 2 - roadBottom, h);
      ctx.closePath();
      ctx.fillStyle = "#25334c";
      ctx.fill();
      for (const lane of [-1.5, -0.5, 0.5, 1.5]) {
        const a = point(lane, 0),
          b = point(lane, 1.1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = Math.abs(lane) > 1 ? "#7fedd3" : "#ffffff16";
        ctx.lineWidth = Math.abs(lane) > 1 ? 3 : 1;
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const z = (i / 16 + s.distance / 180) % 1;
        for (const lane of [-0.5, 0.5]) {
          const a = point(lane, z),
            b = point(lane, Math.min(z + 0.018, 1));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = "#b9d7e077";
          ctx.lineWidth = 1 + z * 3;
          ctx.stroke();
        }
      }
      for (let i = 0; i < 8; i++) {
        const z = (i / 8 + s.distance / 220) % 1;
        for (const side of [-1, 1]) {
          const p = point(side * 2, z);
          ctx.fillStyle = "#1a363a";
          ctx.fillRect(p.x - 2, p.y - 55 * p.scale, 4 * p.scale, 55 * p.scale);
          ctx.fillStyle = "#348875";
          ctx.beginPath();
          ctx.arc(p.x, p.y - 58 * p.scale, 18 * p.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const item of [...s.items].sort((a, b) => a.z - b.z)) {
        if (item.hit && item.kind === "coin") continue;
        const p = point(item.lane, item.z),
          unit = Math.min(w * 0.115, 56) * p.scale;
        if (item.kind === "coin") {
          ctx.save();
          ctx.translate(p.x, p.y - unit * 0.65);
          ctx.rotate(Math.PI / 4);
          roundRect(
            -unit * 0.3,
            -unit * 0.3,
            unit * 0.6,
            unit * 0.6,
            5,
            "#ffe49b",
          );
          ctx.restore();
          ctx.fillStyle = "#815822";
          ctx.font = `bold ${unit * 0.25}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText("</>", p.x, p.y - unit * 0.55);
        } else {
          const tall = item.kind === "block";
          roundRect(
            p.x - unit * 0.55,
            p.y - unit * (tall ? 1.6 : 0.65),
            unit * 1.1,
            unit * (tall ? 1.6 : 0.65),
            5,
            tall ? "#6272bd" : "#f69a6f",
          );
          ctx.fillStyle = tall ? "#cad5ff" : "#623b39";
          ctx.font = `bold ${unit * 0.24}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(
            tall ? "404" : "↑ JUMP",
            p.x,
            p.y - unit * (tall ? 0.75 : 0.25),
          );
        }
      }
      const player = point(s.visualLane, 0.88),
        u = Math.min(w * 0.07, 32),
        air = Math.sin((s.jump / 0.85) * Math.PI) * h * 0.17;
      ctx.fillStyle = "#0005";
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 5, u * 0.9, u * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      const bob =
          s.phase === "running" && !s.jump ? Math.sin(s.time * 22) * 3 : 0,
        py = player.y - air + bob;
      const stride =
        s.phase === "running" && !s.jump ? Math.sin(s.time * 18) * u * 0.22 : 0;
      roundRect(
        player.x - u * 0.48,
        py - u * 0.6 + stride,
        u * 0.37,
        u * 0.7,
        5,
        "#e8efff",
      );
      roundRect(
        player.x + u * 0.11,
        py - u * 0.6 - stride,
        u * 0.37,
        u * 0.7,
        5,
        "#e8efff",
      );
      roundRect(
        player.x - u * 0.7,
        py - u * 1.8,
        u * 1.4,
        u * 1.35,
        u * 0.3,
        "#82f2cf",
      );
      roundRect(
        player.x - u * 0.43,
        py - u * 1.56,
        u * 0.86,
        u * 0.9,
        8,
        "#227d72",
      );
      roundRect(
        player.x - u * 0.48,
        py - u * 2.45,
        u * 0.96,
        u * 0.85,
        u * 0.3,
        "#ecc8a6",
      );
      roundRect(player.x - u * 0.5, py - u * 2.5, u, u * 0.38, 6, "#243049");
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  return (
    <main className="runner-page">
      <header className="runner-nav">
        <Link href="/" className="runner-brand">
          <span>J.</span> JAAGO CAMPUS
        </Link>
        <nav>
          <Link href="/arcade">All games ↗</Link>
          <Link href="/ahmed">Meet Ahmed</Link>
        </nav>
      </header>
      <div className="runner-layout">
        <section className="runner-intro">
          <span className="runner-eyebrow">ONE MORE RUN?</span>
          <h1>
            Your campus.
            <br />
            Your shortcut.
            <br />
            <em>Your high score.</em>
          </h1>
          <p>No forms. No downloads. Just a quick escape between classes.</p>
          <div className="runner-how">
            <h2>Meet Campus Dash</h2>
            <p>
              Run through campus. Grab the gold code tokens. Stay clear of the
              roadblocks.
            </p>
            <ol>
              <li>
                <b>← →</b>
                <span>
                  <strong>Switch lanes</strong>Swipe sideways or use arrow keys.
                </span>
              </li>
              <li>
                <b>↑</b>
                <span>
                  <strong>Jump orange barriers</strong>Swipe up or press Space.
                </span>
              </li>
              <li>
                <b>404</b>
                <span>
                  <strong>Dodge purple blocks</strong>Move into a different
                  lane.
                </span>
              </li>
            </ol>
          </div>
          <Link className="runner-more" href="/arcade">
            Prefer a calmer game? Explore the arcade →
          </Link>
        </section>
        <section className="runner-machine" aria-label="Campus Dash game">
          <div className="runner-hud">
            <div>
              <small>SCORE</small>
              <strong>{score.toLocaleString()}</strong>
            </div>
            <div>
              <small>CODE TOKENS</small>
              <strong>
                <i>◆</i> {stats.coins}
              </strong>
            </div>
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
            {phase === "running" && stats.distance < 85 && (
              <div className="runner-coach">
                Collect gold ◆ · Switch lanes with ← →
              </div>
            )}
            {phase !== "running" && (
              <div className="runner-overlay">
                <div className="runner-dialog">
                  <span className="runner-eyebrow">
                    {phase === "ready"
                      ? "INSTANT PLAY · NO SIGN-UP"
                      : phase === "paused"
                        ? "TAKE YOUR TIME"
                        : "ONE MORE TRY?"}
                  </span>
                  <h2>
                    {phase === "ready" ? (
                      <>
                        CAMPUS
                        <br />
                        <em>DASH</em>
                      </>
                    ) : phase === "paused" ? (
                      "Run paused."
                    ) : (
                      "Nice run."
                    )}
                  </h2>
                  <p>
                    {phase === "ready"
                      ? "Grab gold. Dodge purple. Jump orange."
                      : phase === "paused"
                        ? "Your run is right where you left it."
                        : `${stats.distance} metres · ${stats.coins} code tokens`}
                  </p>
                  {phase === "over" && (
                    <strong className="runner-final">
                      {score.toLocaleString()} <small>POINTS</small>
                    </strong>
                  )}
                  {phase === "over" && <p className="runner-tip">{crashTip}</p>}
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
                    <span>→</span>
                  </button>
                  <small>
                    {phase === "ready"
                      ? "Swipe or use ← → to move · ↑ / Space to jump"
                      : `Your best on this device: ${best.toLocaleString()}`}
                  </small>
                  {phase === "over" && (
                    <Link href="/arcade">Try another game ↗</Link>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="runner-controls">
            <button aria-label="Move left" onClick={() => move(-1)}>
              ← <span>LEFT</span>
            </button>
            <button aria-label="Jump" onClick={jump}>
              ↑ <span>JUMP</span>
            </button>
            <button aria-label="Move right" onClick={() => move(1)}>
              <span>RIGHT</span> →
            </button>
          </div>
          <div className="runner-machine-footer">
            <span>
              PERSONAL BEST <b>{best.toLocaleString()}</b>
            </span>
            <span>1 token = 25 points</span>
          </div>
        </section>
      </div>
      <footer className="runner-campaign">
        <Link href="/ahmed" className="runner-candidate">
          <img src="/ahmed-speaking.jpg" width="48" height="48" alt="Ahmed Malik" />
          <span>
            <small>BUILT BY A STUDENT. FOR STUDENTS.</small>
            <strong>
              Vote Ahmed Malik <span>· Roll No. {campaign.rollNumber}</span>
            </strong>
            <span>
              {campaign.position} · {campaign.votingLabel}
            </span>
          </span>
          <b>Meet Ahmed ↗</b>
        </Link>
        <p>
          Independent student campaign. Not an official Google or university
          website.
        </p>
      </footer>
    </main>
  );
}
