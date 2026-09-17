"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "./Avatar";
import { campaign, cards } from "@/config/campaign";
import {
  boards,
  gameInfo,
  gameRank,
  validBoard,
  validGame,
} from "@/lib/arcade.mjs";
import LiveBoard from "./LiveBoard";
import Arcade from "./Arcade";
import MiniGame from "./MiniGame";
import Profile from "./Profile";
import BuilderStrip from "./BuilderStrip";
import VoteReminder from "./VoteReminder";
import { CampusGame, drawIcon, type Result } from "@/lib/game";
type Player = { id: string; nickname: string; department: string };
async function api(path: string, body?: unknown, key?: string) {
  const r = await fetch("/api/" + path, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error);
  return data;
}
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function Icon({ type }: { type: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) {
      const c = ref.current.getContext("2d")!;
      c.clearRect(0, 0, 64, 64);
      drawIcon(c, type, 32, 32);
    }
  }, [type]);
  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      className="power-icon"
      aria-label={type}
    />
  );
}
function Scene({
  attract = false,
  onEnd,
  onColor,
  muted = true,
  easy = false,
}: {
  attract?: boolean;
  onEnd?: (r: Result) => void;
  onColor?: () => void;
  muted?: boolean;
  easy?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    game = useRef<CampusGame | null>(null);
  const [hud, setHud] = useState({ time: 45, score: 0, vibe: 67 });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    let lastHud = -1;
    const g = new CampusGame(
      ref.current!,
      attract,
      (g) => {
        if (!attract && g.t - lastHud >= 0.1) {
          lastHud = g.t;
          setHud({
            time: Math.ceil(45 - g.elapsed),
            score: g.result.score,
            vibe: Math.round(g.vibe * 100),
          });
        }
      },
      (r) => endRef.current?.(r),
      onColor,
      easy,
    );
    game.current = g;
    return () => g.destroy();
  }, [attract, onColor, easy]);
  useEffect(() => {
    if (game.current) game.current.muted = muted;
  }, [muted]);
  return (
    <div className={"scene " + (attract ? "attract" : "playing")}>
      {!attract && (
        <div className="hud">
          <div>
            <small>Time</small>
            <b className={hud.time <= 10 ? "rush" : ""}>
              {hud.time}
              <span>s</span>
            </b>
          </div>
          <div>
            <small>Score</small>
            <b>{hud.score}</b>
          </div>
          <div className="vibe">
            <small>
              Campus vibe <strong>{hud.vibe}%</strong>
            </small>
            <div>
              <i style={{ width: `${hud.vibe}%` }} />
            </div>
          </div>
        </div>
      )}
      <canvas
        ref={ref}
        aria-label="Campus game. Tap the drifting bore clouds to wake students."
      />
    </div>
  );
}
export default function CampusApp({
  page,
  initialMode,
}: {
  page: string;
  initialMode?: string;
}) {
  const [mode, setMode] = useState(
    page === "leaderboard"
      ? validBoard(initialMode)
        ? initialMode!
        : "dash"
      : validGame(initialMode)
        ? initialMode!
        : "classic",
  );
  const info = gameInfo(mode);
  const [starting, setStarting] = useState(page === "play"),
    [best, setBest] = useState(0),
    [shareLink, setShareLink] = useState("");
  const finished = useRef(false);
  const [player, setPlayer] = useState<Player | null>(null),
    [collection, setCollection] = useState<string[]>([]),
    [nickname, setNickname] = useState(""),
    [department, setDepartment] = useState(campaign.departments[0]),
    [sheet, setSheet] = useState(false),
    [error, setError] = useState(""),
    [muted, setMuted] = useState(true),
    [result, setResult] = useState<Result | null>(null),
    [round, setRound] = useState(0),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [total, setTotal] = useState<number | null>(null),
    [challenge, setChallenge] = useState<{
      nickname: string;
      score: number;
      mode?: string;
    } | null>(null),
    [rank, setRank] = useState<{ rank: number; total: number } | null>(null),
    [unlocked, setUnlocked] = useState<string[]>([]),
    [tab, setTab] = useState("players"),
    [rows, setRows] = useState<Record<string, any>[]>([]),
    [current, setCurrent] = useState<Record<string, any> | null>(null),
    [loading, setLoading] = useState(true),
    [revealed, setRevealed] = useState<string[]>([]),
    [qr, setQr] = useState(""),
    [adminKey, setAdminKey] = useState(""),
    [admin, setAdmin] = useState<any>(null);
  const token = useRef("");
  useEffect(() => {
    setPlayer(read("jaago-player", null));
    setCollection(read("jaago-cards", []));
    setMuted(read("jaago-muted", true));
    setReady(true);
    if (page === "home") {
      void api("stats")
        .then((d) => setTotal(d.totalWoken))
        .catch(() => {});
      const c = new URLSearchParams(location.search).get("c");
      if (c)
        void api("challenge/" + encodeURIComponent(c))
          .then(setChallenge)
          .catch(() => setError("Challenge nahi mila. Apna high score banao."));
    }
    if (page === "print")
      void import("qrcode")
        .then((q) =>
          q.toDataURL(campaign.siteUrl, {
            width: 700,
            margin: 2,
            color: { dark: "#1D2A5C" },
          }),
        )
        .then(setQr);
    if (page === "admin")
      setAdminKey(sessionStorage.getItem("jaago-admin") || "");
  }, [page]);
  useEffect(() => {
    if (page === "play" && ready) {
      document.body.classList.add("game-page");
      if (!player) setSheet(true);
      else void startSession(player).finally(() => setStarting(false));
      return () => document.body.classList.remove("game-page");
    }
  }, [page, ready]);
  useEffect(() => {
    if (page !== "leaderboard") return;
    let active = true;
    const load = () => {
      void api("leaderboard?type=" + tab + "&game=" + mode)
        .then((d) => {
          if (active) {
            setRows(d.rows);
            setCurrent(d.current);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Leaderboard load nahi hua. Refresh karo.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [page, tab, mode]);
  async function startSession(p: Player) {
    token.current = "";
    try {
      const profile = await api("player", {
        nickname: p.nickname,
        department: p.department,
      });
      setPlayer(profile);
      save("jaago-player", profile);
      const d = await api("session/start", { mode });
      token.current = d.token;
    } catch {}
  }
  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { validNickname } = await import("@/lib/validation.mjs");
      const name = validNickname(nickname);
      const local = { id: crypto.randomUUID(), nickname: name, department };
      let p = local;
      try {
        p = await api("player", { nickname: name, department });
      } catch (e) {
        if (
          e instanceof Error &&
          !/connect|configuration|fetch|network|timeout|abort|unavailable/i.test(
            e.message,
          )
        )
          throw e;
      }
      save("jaago-player", p);
      setPlayer(p);
      setSheet(false);
      if (page === "play") {
        await startSession(p);
        setRound((n) => n + 1);
        setStarting(false);
      } else location.href = "/play?game=" + mode;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish(r: Result) {
    if (finished.current) return;
    finished.current = true;
    r.mode = mode;
    setResult(r);
    const bests = read<Record<string, number>>("jaago-bests", {});
    const nextBest = Math.max(bests[mode] || 0, r.score);
    save("jaago-bests", { ...bests, [mode]: nextBest });
    setBest(nextBest);
    const old = read<string[]>("jaago-cards", []),
      fresh = r.cards.filter((c) => !old.includes(c)),
      all = [...new Set([...old, ...r.cards])];
    setCollection(all);
    setUnlocked(fresh);
    save("jaago-cards", all);
    setError("");
    if (token.current) {
      const submittedToken = token.current;
      try {
        const savedRank = await api("score", { ...r, token: submittedToken });
        if (token.current === submittedToken && finished.current)
          setRank(savedRank);
      } catch {
        if (token.current === submittedToken && finished.current)
          setError(
            "Personal best is saved on this device. Shared score save nahi hua. Internet check karo.",
          );
      }
    } else
      setError(
        "Personal best saved on this device. Shared leaderboard abhi connected nahi hai.",
      );
  }
  async function replay() {
    setStarting(true);
    finished.current = false;
    setResult(null);
    setRank(null);
    setError("");
    setShareLink("");
    if (player) await startSession(player);
    setRound((n) => n + 1);
    setStarting(false);
  }
  async function share(challengeOnly = false, downloadOnly = false) {
    if (!result || !player) return;
    setBusy(true);
    try {
      let link = `${location.origin}/play?game=${mode}`,
        score = result.score;
      if (challengeOnly) {
        const c = await api("challenge", { mode });
        link = `${location.origin}/?c=${c.code}`;
        score = c.score;
        setShareLink(link);
      }
      const text = `Maine ${info.name} mein ${score} kiya! Beat karke dikhao: ${link}`;
      if (challengeOnly) {
        if (navigator.share) await navigator.share({ text, url: link });
        else {
          try {
            await navigator.clipboard.writeText(text);
            setError("Challenge link copy ho gaya. Dost ko bhejo.");
          } catch {
            setError("Challenge ready. Neeche se link copy karo.");
          }
        }
        return;
      }
      const c = document.createElement("canvas");
      c.width = 1080;
      c.height = 1920;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#F8F4E9";
      ctx.fillRect(0, 0, 1080, 1920);
      const palette = ["#E4312B", "#FFC20E", "#1FA85B", "#F2338C", "#2356D8"];
      for (let y = 0; y < 1920; y += 60) {
        ctx.fillStyle = palette[(y / 60) % 5];
        ctx.beginPath();
        ctx.arc(30, y, 28, 0, 7);
        ctx.arc(1050, y, 28, 0, 7);
        ctx.fill();
      }
      for (let x = 0; x < 1080; x += 60) {
        ctx.fillStyle = palette[(x / 60) % 5];
        ctx.fillRect(x, 0, 50, 28);
        ctx.fillRect(x, 1892, 50, 28);
      }
      ctx.fillStyle = "#1D2A5C";
      ctx.textAlign = "center";
      const line = (s: string, y: number, size: number) => {
        ctx.font = `900 ${size}px Rubik, sans-serif`;
        ctx.fillText(s, 540, y, 900);
      };
      line("JAAGO", 340, 130);
      line("CAMPUS", 480, 130);
      line(player.nickname, 690, 55);
      line(String(result.score), 1030, 240);
      line(gameRank(mode, result.score), 1160, 58);
      line(info.name, 1290, 50);
      line(`Beat me: ${location.host}`, 1470, 42);
      line(`Vote ${campaign.candidateName}`, 1640, 56);
      line(campaign.position, 1730, 35);
      line(campaign.votingLabel, 1810, 39);
      line(`Roll No. ${campaign.rollNumber}`, 1870, 32);
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob(resolve),
      );
      if (!blob) throw Error("Image nahi bani. Dobara try karo.");
      const file = new File([blob], "jaago-campus.png", { type: "image/png" });
      if (!downloadOnly && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], text });
      else {
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        if (downloadOnly) {
          setError("Score card download ho gaya. Apni story pe lagao.");
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
          setError("Image download ho gayi. Share text copy ho gaya.");
        } catch {
          setError("Image download ho gayi. Share it with your friends.");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(
          challengeOnly
            ? "Challenge save nahi hua. Internet check karo aur dobara try karo."
            : (e as Error).message,
        );
    } finally {
      setBusy(false);
    }
  }
  async function adminLoad() {
    setError("");
    try {
      setAdmin(await api("admin", undefined, adminKey));
      sessionStorage.setItem("jaago-admin", adminKey);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function adminAction(action: string, id: string) {
    const nickname = action === "rename" ? prompt("Naya nickname") : undefined;
    if (action === "rename" && !nickname) return;
    if (
      action === "delete" &&
      !confirm("Delete this score and recalculate totals?")
    )
      return;
    try {
      await api("admin", { action, id, nickname }, adminKey);
      await adminLoad();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const playLink = (
    <Link
      className="button primary"
      href={challenge ? `/play?game=${challenge.mode || "classic"}` : "/arcade"}
    >
      {challenge ? "Beat this score" : "Choose a game"}{" "}
      <span className="play-triangle" />
    </Link>
  );
  return (
    <main className={page === "play" ? "app game-shell" : "app"}>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-flower">✳</span> jaago
          <span className="brand-dot">.</span>
        </Link>
        <span className="edition">A campus that feels alive.</span>
        <Link className="arcade-nav" href="/arcade">
          Arcade
        </Link>
        <Link className="about-nav" href={page === "ahmed" ? "/" : "/ahmed"}>
          {page === "ahmed" ? "Back to campus" : "Meet Ahmed"}
        </Link>
      </header>
      {page === "arcade" && <Arcade />}
      {page === "home" && (
        <>
          <section className="landing">
            <div className="hero-copy">
              <div className="campaign-label">
                <span /> {campaign.candidateName} for {campaign.position}
              </div>
              <h1>
                Sab ne poster
                <br />
                lagaye.
                <br />
                <span>
                  Maine game
                  <br />
                  bana diya.
                </span>
              </h1>
              <p className="intro">
                Campus so raha hai.
                <br /> Apni game chuno. Campus jagao.
              </p>
              {challenge && (
                <div className="challenge-banner">
                  {challenge.nickname} ne {challenge.score} kiya. Beat kar sakte
                  ho? <b>{gameInfo(challenge.mode).name}</b>
                </div>
              )}
              <div className="hero-actions">
                {playLink}
                <span>
                  Easy bhi. Challenging bhi.
                  <br />
                  One thumb. Full vibe.
                </span>
              </div>
              <div className="hero-links">
                <Link href="/leaderboard">Leaderboard</Link>
                <Link href="/ahmed">Kaun hai Ahmed?</Link>
              </div>
              {total !== null && (
                <p className="live">
                  <span />
                  {total.toLocaleString()} students ab tak jaag chuke hain
                </p>
              )}
              {campaign.votingDate && (
                <p>
                  {campaign.votingLabel}.
                  {Date.now() < Date.parse(campaign.votingDate)
                    ? ` Voting starts in ${Math.ceil((Date.parse(campaign.votingDate) - Date.now()) / 86400000)} din.`
                    : Date.now() <= Date.parse(campaign.votingEndDate)
                      ? " Voting is open."
                      : ""}
                </p>
              )}
            </div>
            <div className="campus-preview">
              <div className="preview-label">
                <span className="live-pill" /> Campus status: sleepy{" "}
                <span>Tap a cloud</span>
              </div>
              <Scene attract />
              <div className="preview-caption">
                <span className="tiny-flower">✳</span>
                <b>Thora tap. Bohat saari jaan.</b>
                <span className="tiny-flower">✳</span>
              </div>
              <div className="sticker">
                Bore clouds?
                <br />
                <strong>Phor do.</strong>
              </div>
            </div>
          </section>
          <div className="color-stripe" />
          <BuilderStrip />
          <section className="below">
            <div>
              <span className="section-number">01 / The mission</span>
              <h2>
                Campus bore
                <br />
                nahi hoga.
              </h2>
              <p>
                Clouds phoro. Doston ko jagao.
                <br />
                Campus mein rang wapas lao.
              </p>
            </div>
            <div className="power-list">
              {cards.map((c, i) => (
                <div key={c.id}>
                  <Icon type={c.id} />
                  <div>
                    <b>
                      {
                        [
                          "Naye log. Nayi baatein.",
                          "Ideas ko scene do.",
                          "Semester mein jaan lao.",
                          "Pehle ek chai.",
                        ][i]
                      }
                    </b>
                    <span>
                      {
                        [
                          "Baithaq",
                          "Hackathon mode",
                          "Event on hai",
                          "Chai break",
                        ][i]
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {page === "play" && (
        <section className="play-wrap">
          <div className="play-top">
            <Link href="/arcade">All games</Link>
            <span className="play-mode-label">{info.name}</span>
            <button
              className="small-button"
              onClick={() => {
                setMuted(!muted);
                save("jaago-muted", !muted);
              }}
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
          </div>
          {ready &&
            player &&
            !sheet &&
            !starting &&
            (mode === "chai" || mode === "memory" ? (
              <MiniGame key={round} mode={mode} muted={muted} onEnd={finish} />
            ) : (
              <Scene
                key={round}
                easy={mode === "easy"}
                muted={muted}
                onEnd={finish}
              />
            ))}{" "}
          {(!ready || starting) && !sheet && (
            <p className="loading">Campus tayyar ho raha hai...</p>
          )}{" "}
          {result && (
            <div className="result-backdrop">
              <div
                className="result-card"
                role="dialog"
                aria-modal="true"
                aria-label="Round result"
              >
                <span className="section-number">
                  {result.earlyEnd
                    ? "Campus so gaya. Dobara jagao?"
                    : mode === "memory" && result.pairs === 6
                      ? "Full board. Nice!"
                      : "Round complete!"}{" "}
                  / {info.name}
                </span>
                <h2>
                  Tum ne{" "}
                  <em>
                    {mode === "chai"
                      ? result.hits
                      : mode === "memory"
                        ? result.pairs
                        : result.woken}
                  </em>
                  <br />
                  {mode === "chai"
                    ? "chai serve ki."
                    : mode === "memory"
                      ? "pairs dhoond liye."
                      : "students jagaye."}
                </h2>
                <strong className="big-score">{result.score}</strong>
                <h3>{gameRank(mode, result.score)}</h3>
                <p>
                  Your best in {info.name}: <b>{best}</b>
                </p>
                {rank && (
                  <p>
                    #{rank.rank} out of {rank.total} players
                  </p>
                )}
                <LiveBoard
                  game={mode}
                  limit={5}
                  refreshKey={rank ? rank.rank : 0}
                  title="Live top 5"
                />
                {unlocked.length > 0 && (
                  <div className="unlock">
                    <small>New card unlocked</small>
                    {unlocked.map((id) => (
                      <Link href="/ahmed" key={id}>
                        {cards.find((c) => c.id === id)?.title}
                      </Link>
                    ))}
                  </div>
                )}
                {collection.length === 4 && (
                  <p>Full set. Ab tumhe pata hai vote kisko dena hai.</p>
                )}
                <button
                  className="button primary"
                  onClick={replay}
                  disabled={busy}
                >
                  Dobara khelo
                </button>
                <div className="result-actions">
                  <button onClick={() => share()} disabled={busy}>
                    Share score
                  </button>
                  <button onClick={() => share(false, true)} disabled={busy}>
                    Download card
                  </button>
                  <button onClick={() => share(true)} disabled={busy}>
                    Challenge a friend
                  </button>
                </div>
                {shareLink && (
                  <div className="share-link">
                    <label>
                      Challenge link
                      <input
                        readOnly
                        value={shareLink}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Maine ${info.name} mein score banaya. Beat karke dikhao: ${shareLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Share on WhatsApp
                    </a>
                  </div>
                )}
                {error && (
                  <p role="status" className="notice">
                    {error}
                  </p>
                )}
                <VoteReminder />
                <p>Socho poora semester kya hoga.</p>
                <Link href="/ahmed">Kaun hai Ahmed?</Link>
                <div className="result-navigation">
                  <Link href="/arcade">Try another game</Link>
                  <Link href={"/leaderboard?game=" + mode}>
                    This leaderboard
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
      {page === "ahmed" && (
        <section className="content-page">
          <Profile />
          <span className="section-number">The person behind the game</span>
          <h1>
            Waade sab karte hain.
            <br />
            <span>Main bana ke dikhata hoon.</span>
          </h1>
          <p className="intro">Main Ahmed hoon. Aur campus bore nahi hoga.</p>
          <div className="collection-count">
            Your collection <b>{collection.length} / 4</b>
            <span>Swipe to explore</span>
          </div>
          <div className="manifesto-rail">
            {cards.map((card, i) => {
              const locked =
                !collection.includes(card.id) && !revealed.includes(card.id);
              return (
                <article
                  key={card.id}
                  className={"manifesto-card " + (i === 0 ? "baithaq" : "")}
                >
                  <div className="card-heading">
                    <Icon type={card.id} />
                    <span>{String(i + 1).padStart(2, "0")} / 04</span>
                  </div>
                  {card.id === "chai" && <Avatar />}
                  <small>{card.title}</small>
                  <h2>{card.headline}</h2>
                  {locked ? (
                    <div className="locked">
                      <div className="blur-lines" aria-hidden="true" />
                      <h3>Game mein unlock karo</h3>
                      <button
                        className="text-button"
                        onClick={() => setRevealed([...revealed, card.id])}
                      >
                        Abhi padh lo
                      </button>
                    </div>
                  ) : (
                    <>
                      <p>{card.body}</p>
                      {card.why && <p className="why">{card.why}</p>}
                      {card.proof && campaign.showBaithaqProof && (
                        <p>{card.proof}</p>
                      )}
                      {card.id === "chai" && (
                        <a
                          className="button"
                          href={campaign.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          LinkedIn
                        </a>
                      )}
                    </>
                  )}
                </article>
              );
            })}
            <article className="manifesto-card vote-card">
              <span className="big-flower">✳</span>
              <h2>Apne dost ko vote do.</h2>
              <p>Ya us bande ko jo har doosre hafte tumhe naye dost dilwaye.</p>
              <h3>
                {campaign.candidateName} for {campaign.position}
              </h3>
              {campaign.ballotNumber && <p>Ballot #{campaign.ballotNumber}</p>}
              <p>Roll No. {campaign.rollNumber}</p>
              {campaign.votingDate && <p>{campaign.votingLabel}</p>}
              {playLink}
            </article>
          </div>
        </section>
      )}
      {page === "leaderboard" && (
        <section className="content-page leaderboard">
          <span className="section-number">Bragging rights only</span>
          <h1>
            Campus ke
            <br />
            <span>jaagte hue log.</span>
          </h1>
          <label className="game-filter">
            Choose a leaderboard
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {boards.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <p className="live-status">
            <span className="live-pill">Live</span> Refreshes every 15 seconds
          </p>
          <p className="board-note">
            Scores compete within the same game. Department totals count
            students woken in campus rounds.
          </p>
          <div className="tabs">
            {["players", "departments"].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t === "players" ? "Players" : "Departments"}
              </button>
            ))}
          </div>
          {tab === "departments" && (
            <h2>Kaunsa department sab se kam bore hai?</h2>
          )}
          {loading ? (
            <p>Leaderboard aa raha hai...</p>
          ) : error ? (
            <div className="empty">
              <p role="status">{error}</p>
              <button className="button" onClick={() => location.reload()}>
                Refresh
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <h2>Abhi koi score nahi.</h2>
              <p>Pehla naam tumhara ho sakta hai.</p>
              {playLink}
            </div>
          ) : (
            <>
              <div className="table-label">
                <span>
                  Rank / {tab === "players" ? "Player" : "Department"}
                </span>
                <span>
                  {tab === "players" ? "Best score" : "Students woken"}
                </span>
              </div>
              {rows.map((r, i) => (
                <div className="score-row" key={r.id}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>
                      {r.nickname || r.name}{" "}
                      {r.cardsCollected === 4 && (
                        <span title="Full collection">✳</span>
                      )}
                    </strong>
                    {r.department && <small>{r.department}</small>}
                  </div>
                  <b>{tab === "players" ? r.bestScore : r.totalWoken}</b>
                </div>
              ))}
              {current && !rows.some((r) => r.id === current.id) && (
                <div className="score-row pinned">
                  <b>{current.rank}</b>
                  <strong>{current.nickname} (you)</strong>
                  <b>{current.bestScore}</b>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {page === "print" && (
        <section className="print-page">
          <h1>
            Scan karo.
            <br />
            Khelo.
            <br />
            <span>Campus jagao.</span>
          </h1>
          {qr && (
            <img
              src={qr}
              alt="QR code to Jaago Campus"
              width="320"
              height="320"
            />
          )}
          <h2>
            {campaign.candidateName} for {campaign.position}
          </h2>
          <p>
            <strong>Vote on {campaign.votingLabel}</strong>
          </p>
          <p>Roll No. {campaign.rollNumber}</p>
          <p>{campaign.siteUrl.replace("https://", "")}</p>
          <button className="button primary" onClick={() => window.print()}>
            Print poster
          </button>
        </section>
      )}
      {page === "admin" && (
        <section className="content-page">
          <h1>Campus control.</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void adminLoad();
            }}
          >
            <label>
              Admin key
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button primary">Open dashboard</button>
          </form>
          {error && <p role="status">{error}</p>}
          {admin && (
            <>
              <div className="admin-stats">
                {Object.entries(admin.stats || {}).map(([k, v]) => (
                  <p key={k}>
                    {k}: <b>{String(v)}</b>
                  </p>
                ))}
              </div>
              {admin.scores.map((s: any) => (
                <div className="admin-row" key={s.id}>
                  <p>
                    {s.playerId}
                    <br />
                    Score: {s.score} / Woken: {s.woken}
                  </p>
                  <button onClick={() => adminAction("delete", s.id)}>
                    Delete score
                  </button>
                  <button onClick={() => adminAction("ban", s.playerId)}>
                    Ban player
                  </button>
                  <button onClick={() => adminAction("rename", s.playerId)}>
                    Rename
                  </button>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {page !== "play" && (
        <footer>
          <div>
            <b>
              {campaign.candidateName} for {campaign.position}.
            </b>
            <span>Campus bore nahi hoga.</span>
          </div>
          <p>
            Independent student campaign by Ahmed Malik. Not an official Air
            University website.
          </p>
        </footer>
      )}
      {page === "play" && <VoteReminder compact />}
      {page === "play" && (
        <p className="game-disclaimer">
          Independent student campaign by Ahmed Malik. Not an official Air
          University website.
        </p>
      )}
      {sheet && (
        <div className="sheet-backdrop">
          <form
            className="nickname-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose your nickname"
            onSubmit={register}
          >
            <button
              type="button"
              className="close-button"
              aria-label="Close"
              onClick={() => {
                setSheet(false);
                if (page === "play") location.href = "/";
              }}
            >
              ×
            </button>
            <span className="section-number">Pehle introduction</span>
            <h2>Leaderboard pe naam kya likhein?</h2>
            <label>
              Nickname
              <input
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                minLength={3}
                maxLength={16}
                placeholder="Chai champion"
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
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Ek second..." : "Let's go"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
