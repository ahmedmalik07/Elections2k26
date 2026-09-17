"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { games } from "@/lib/arcade.mjs";
import BuilderStrip from "./BuilderStrip";
import VoteReminder from "./VoteReminder";
import LiveBoard from "./LiveBoard";
export function GameSymbol({ type }: { type: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "chai" ? (
        <>
          <path d="M19 34h34v21q0 12-17 12T19 55Z" />
          <path d="M53 38h5q18 0 10 14-4 6-15 5M28 24q-7-7 0-14M42 24q7-7 0-14M14 70h45" />
        </>
      ) : type === "trophy" ? (
        <>
          <rect
            x="10"
            y="14"
            width="31"
            height="44"
            rx="5"
            transform="rotate(-9 25 35)"
          />
          <rect
            x="35"
            y="23"
            width="32"
            height="44"
            rx="5"
            transform="rotate(9 50 45)"
          />
          <path d="m50 35 3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
        </>
      ) : type === "chair" ? (
        <>
          <path d="M20 39q-11-4-5-13 4-6 12-3 2-19 20-12 10 3 10 14 15-2 15 11 0 10-13 10H24q-8 0-8-7M30 30h2m15 0h2M32 36q7 8 14 0M27 54l-6 8m21-8v12m17-12 6 8" />
        </>
      ) : (
        <>
          <path d="M18 49q-15-7-8-19 5-8 15-5 4-24 24-16 13 4 13 19 18-2 15 15-1 9-17 9H21M26 31l9 4m13 0 9-4M32 42h17M40 54l-9 13h10l-4 12 18-19H44l5-6" />
        </>
      )}
    </svg>
  );
}
export default function Arcade() {
  const [best, setBest] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      setBest(JSON.parse(localStorage.getItem("jaago-bests") || "{}"));
    } catch {}
  }, []);
  return (
    <section className="arcade-page">
      <div className="arcade-heading">
        <span className="section-number">Your break starts here</span>
        <h1>
          Pick a game.
          <br />
          <span>Start in seconds.</span>
        </h1>
        <p>
          Run, match, or just tap. Choose your pace — each game explains the
          controls before you start.
        </p>
        <div className="arcade-summary">
          <span>4 games + a chill mode</span>
          <span>Quick breaks, instant replays</span>
          <span>No downloads</span>
        </div>
      </div>
      <Link href="/run" className="runner-feature">
        <span>
          <small>New · E-9 campus runner</small>
          <strong>Campus Dash ↗</strong>
          <span>
            Collect votes, jump quiz hurdles and dodge deadlines from the E-9
            gate to the Margallas. How far can you go?
          </span>
        </span>
        <b>Play now →</b>
      </Link>
      <BuilderStrip />
      <VoteReminder />
      <div className="arcade-grid">
        {games.map((g, i) => (
          <article className={"arcade-tile " + g.color} key={g.id}>
            <div className="tile-top">
              <span>{g.tag}</span>
              <span>0{i + 1}</span>
            </div>
            <div className="game-illustration">
              <GameSymbol type={g.icon} />
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
            </div>
            <div className="game-meta">
              <span>{g.level}</span>
              <span>{g.seconds}s</span>
            </div>
            <h2>{g.name}</h2>
            <p>{g.description}</p>
            <div className="tile-bottom">
              <Link className="button primary" href={"/play?game=" + g.id}>
                Play {g.name}
              </Link>
              <small>
                {best[g.id] !== undefined
                  ? `Your best: ${best[g.id]}`
                  : "Your first score awaits"}
              </small>
            </div>
          </article>
        ))}
      </div>
      <div className="arcade-live">
        <LiveBoard tabs limit={5} title="Live leaderboards" />
      </div>
      <div className="arcade-note">
        <b>Same campus. Fair competition.</b>
        <p>
          Har game ka apna leaderboard hai. Play any game to collect the
          campaign cards.
        </p>
        <Link href="/leaderboard">See the leaderboards</Link>
      </div>
    </section>
  );
}
