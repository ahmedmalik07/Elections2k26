"use client";
import { useEffect, useRef, useState } from "react";
import {
  earnedCards,
  gameInfo,
  memoryScore,
  shufflePairs,
} from "@/lib/arcade.mjs";
import { GameSymbol } from "./Arcade";
import type { Result } from "@/lib/game";
const icons = ["HTML", "CSS", "JS", "Git", "API", "CLI"];
const tips = [
  "HTML gives a page its structure.",
  "CSS controls how a page looks.",
  "JavaScript makes a page interactive.",
  "Git tracks changes to your code.",
  "An API lets two apps talk to each other.",
  "A CLI lets you work from a terminal.",
];
export default function MiniGame({
  mode,
  onEnd,
  muted,
}: {
  mode: string;
  onEnd: (r: Result) => void;
  muted: boolean;
}) {
  const info = gameInfo(mode),
    [started, setStarted] = useState(false),
    [time, setTime] = useState(info.seconds),
    [target, setTarget] = useState(4),
    [hits, setHits] = useState(0),
    [deck] = useState(() => shufflePairs()),
    [open, setOpen] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]),
    [mistakes, setMistakes] = useState(0),
    [paused, setPaused] = useState(false),
    [feedback, setFeedback] = useState(""),
    [countdown, setCountdown] = useState(3);
  const state = useRef({
      hits: 0,
      pairs: 0,
      mistakes: 0,
      elapsed: 0,
      done: false,
    }),
    end = useRef(onEnd),
    sound = useRef<AudioContext | null>(null),
    lastTap = useRef(0),
    hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  end.current = onEnd;
  function finish() {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    const cards = earnedCards(mode, mode === "chai" ? s.hits : s.pairs);
    end.current({
      mode,
      score: mode === "chai" ? s.hits * 10 : memoryScore(s.pairs, s.mistakes),
      woken: 0,
      pops: 0,
      maxCombo: 0,
      powerupsUsed: 0,
      durationMs: Math.round(s.elapsed * 1000),
      earlyEnd: false,
      cards,
      hits: s.hits,
      pairs: s.pairs,
      mistakes: s.mistakes,
    });
  }
  function ping() {
    if (muted) return;
    try {
      sound.current ??= new AudioContext();
      const a = sound.current;
      void a.resume();
      const o = a.createOscillator(),
        g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.value = mode === "chai" ? 660 : 880;
      g.gain.setValueAtTime(0.06, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.13);
      o.start();
      o.stop(a.currentTime + 0.15);
    } catch {}
  }
  useEffect(() => {
    let last = performance.now(),
      elapsed = 0;
    const tick = setInterval(() => {
      const now = performance.now(),
        dt = (now - last) / 1000;
      last = now;
      if (document.hidden || state.current.done) return;
      elapsed += dt;
      if (elapsed < 3) {
        setCountdown(3 - Math.floor(elapsed));
        return;
      }
      setStarted(true);
      state.current.elapsed = Math.min(info.seconds, elapsed - 3);
      setTime(Math.max(0, Math.ceil(info.seconds - state.current.elapsed)));
      if (state.current.elapsed >= info.seconds) finish();
    }, 50);
    const visibility = () => {
      last = performance.now();
      setPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", visibility);
      if (hide.current) clearTimeout(hide.current);
      void sound.current?.close();
    };
  }, []);
  function tapCup(i: number) {
    if (
      !started ||
      state.current.done ||
      i !== target ||
      performance.now() - lastTap.current < 100
    )
      return;
    lastTap.current = performance.now();
    state.current.hits++;
    setHits(state.current.hits);
    setTarget((i + 1 + Math.floor(Math.random() * 8)) % 9);
    setFeedback("+10! Chai ready. Back to the build.");
    ping();
  }
  function flip(i: number) {
    if (
      !started ||
      state.current.done ||
      open.length === 2 ||
      open.includes(i) ||
      matched.includes(deck[i])
    )
      return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      if (deck[next[0]] === deck[i]) {
        const pairs = [...matched, deck[i]];
        setMatched(pairs);
        state.current.pairs = pairs.length;
        setFeedback(tips[deck[i]]);
        ping();
        setOpen([]);
        if (pairs.length === 6) finish();
      } else {
        state.current.mistakes++;
        setMistakes(state.current.mistakes);
        setFeedback("Yaad rakho. Dobara try karo.");
        hide.current = setTimeout(() => setOpen([]), 700);
      }
    }
  }
  const score =
    mode === "chai" ? hits * 10 : memoryScore(matched.length, mistakes);
  return (
    <div
      className={"mini-game " + (mode === "chai" ? "chai-game" : "memory-game")}
    >
      <div className="mini-hud">
        <div>
          <small>Time</small>
          <b>{time}s</b>
        </div>
        <div>
          <small>Score</small>
          <b>{score}</b>
        </div>
        <div>
          <small>{mode === "chai" ? "Cups" : "Pairs"}</small>
          <b>{mode === "chai" ? hits : `${matched.length}/6`}</b>
        </div>
      </div>
      <div className="mini-intro">
        <h2>{info.name}</h2>
        <p>{info.instruction}</p>
      </div>
      {!started && (
        <div className="mini-countdown" aria-live="polite">
          {countdown}
        </div>
      )}
      {paused && <p className="pause-note">Paused. Wapas aao, phir khelo.</p>}
      {mode === "chai" ? (
        <div className="cup-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <button
              key={i}
              aria-label={i === target ? "Serve hot chai" : "Empty cup spot"}
              disabled={!started}
              className={"cup-target " + (i === target ? "hot" : "")}
              onClick={() => tapCup(i)}
            >
              <GameSymbol type="chai" />
              <span>{i === target ? "Tap!" : " "}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="memory-grid">
          {deck.map((value, i) => {
            const visible = open.includes(i) || matched.includes(value);
            return (
              <button
                key={i}
                disabled={!started || matched.includes(value)}
                aria-label={
                  matched.includes(value)
                    ? `Matched ${icons[value]}`
                    : visible
                      ? `${icons[value]} card`
                      : `Flip card ${i + 1}`
                }
                className={
                  "memory-tile " +
                  (visible ? "flipped" : "") +
                  (matched.includes(value) ? " matched" : "")
                }
                onClick={() => flip(i)}
              >
                {visible ? (
                  <span className="dev-label">{icons[value]}</span>
                ) : (
                  <span>?</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className="mini-feedback" role="status">
        {feedback ||
          (mode === "chai"
            ? "Yellow cup pe tap karo."
            : "Two cards. One pair. You got this.")}
      </p>
      <div className="mini-bottom">
        {mode === "chai"
          ? "No rush. No wrong-tap penalty."
          : `${mistakes} wrong guesses. Every pair earns 50 points.`}
      </div>
    </div>
  );
}
