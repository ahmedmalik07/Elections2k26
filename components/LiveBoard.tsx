"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { boards } from "@/lib/arcade.mjs";

type Row = {
  id: string;
  nickname: string;
  department?: string;
  bestScore: number;
};
type Board = {
  rows: Row[];
  current: (Row & { rank: number }) | null;
  updatedAt: number;
  stale?: boolean;
};
// The boards are cached for a minute on the server, so polling faster than this
// only spends Firebase quota without ever showing anything new.
const REFRESH_MS = 60000;

export default function LiveBoard({
  game = "dash",
  tabs = false,
  limit = 10,
  refreshKey = 0,
  title = "Live leaderboard",
}: {
  game?: string;
  tabs?: boolean;
  limit?: number;
  refreshKey?: number;
  title?: string;
}) {
  const [selected, setSelected] = useState(game);
  const [board, setBoard] = useState<Board | null>(null);
  const [mine, setMine] = useState<(Row & { rank: number }) | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => setSelected(game), [game]);
  useEffect(() => {
    let active = true;
    let loaded = false;
    setBoard(null);
    setMine(null);
    setOffline(false);
    const load = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(
          `/api/leaderboard?game=${selected}&limit=${limit}`,
          { signal: AbortSignal.timeout(10000) },
        );
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (active) {
          loaded = true;
          setBoard(data);
          setOffline(false);
        }
      } catch {
        // A failed refresh leaves the scores already on screen, rather than
        // blanking the board as it did when Firebase ran out of daily quota.
        if (active && !loaded) setOffline(true);
      }
    };
    const loadMine = async () => {
      try {
        const r = await fetch(`/api/leaderboard/me?game=${selected}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const data = await r.json();
        if (active && r.ok && data.current) setMine(data.current);
      } catch {}
    };
    void loadMine();
    void load();
    const timer = setInterval(load, REFRESH_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", load);
    };
  }, [selected, limit, refreshKey]);

  const info = boards.find((b) => b.id === selected) || boards[0];
  const age =
    board && now ? Math.max(0, Math.round((now - board.updatedAt) / 1000)) : 0;
  const current = mine ?? board?.current;

  return (
    <section className="live-board" aria-label={`${title}: ${info.name}`}>
      <header>
        <div>
          <span className={"live-pill" + (offline ? " off" : "")}>
            {offline ? "Offline" : "Live"}
          </span>
          <h2>{title}</h2>
        </div>
        {!tabs && <small>{info.name}</small>}
      </header>
      {tabs && (
        <div className="live-tabs" role="tablist">
          {boards.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={selected === b.id}
              className={selected === b.id ? "selected" : ""}
              onClick={() => setSelected(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
      {offline ? (
        <p className="live-empty">
          The board is taking a short break. Every saved score is safe and will
          be back shortly. Your best score is still on this device.
        </p>
      ) : !board ? (
        <ol className="live-rows" aria-busy="true">
          {Array.from({ length: Math.min(limit, 5) }, (_, i) => (
            <li key={i} className="skeleton">
              <b>{i + 1}</b>
              <span />
            </li>
          ))}
        </ol>
      ) : board.rows.length === 0 ? (
        <p className="live-empty">
          No scores yet. The first name on this board could be yours.
        </p>
      ) : (
        <ol className="live-rows">
          {board.rows.map((r, i) => (
            <li
              key={r.id}
              className={
                (i < 3 ? `podium p${i + 1}` : "") +
                (current?.id === r.id ? " you" : "")
              }
            >
              <b>{i + 1}</b>
              <span>
                <strong>
                  {r.nickname}
                  {current?.id === r.id && <em> (you)</em>}
                </strong>
                {r.department && <small>{r.department}</small>}
              </span>
              <i>{(r.bestScore || 0).toLocaleString()}</i>
            </li>
          ))}
          {current && !board.rows.some((r) => r.id === current.id) && (
            <li className="you pinned">
              <b>{current.rank}</b>
              <span>
                <strong>
                  {current.nickname}
                  <em> (you)</em>
                </strong>
              </span>
              <i>{current.bestScore.toLocaleString()}</i>
            </li>
          )}
        </ol>
      )}
      <footer>
        <span>
          {offline
            ? "Retrying every minute"
            : board?.stale
              ? "Showing the last saved scores · updating again shortly"
              : board
                ? `Updated ${age < 60 ? "just now" : `${Math.round(age / 60)} min ago`} · refreshes every minute`
                : "Loading scores…"}
        </span>
        <Link href={`/leaderboard?game=${selected}`}>Full board →</Link>
      </footer>
    </section>
  );
}
