import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { db, owner, sign, verify, code, getChallenge } from "@/lib/server";
import {
  validNickname,
  validateScore,
  validatedCards,
} from "@/lib/validation.mjs";
import { validBoard } from "@/lib/arcade.mjs";
import { createBoardCache, playersBy } from "@/lib/boardCache.mjs";
import { campaign } from "@/config/campaign";
export const runtime = "nodejs";
// Live boards come from one cached snapshot document; see lib/boardCache.mjs.
const boards = createBoardCache();
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  try {
    if (
      req.method === "POST" &&
      req.headers.get("origin") &&
      new URL(req.headers.get("origin")!).host !== req.headers.get("host")
    )
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    if (path.startsWith("challenge/") && req.method === "GET") {
      const data = await getChallenge(path.split("/")[1]);
      return NextResponse.json(data || { error: "Challenge nahi mila." }, {
        status: data ? 200 : 404,
      });
    }
    if (path === "health" && req.method === "GET") {
      const configured =
        !!(
          (process.env.FIREBASE_PROJECT_ID &&
            process.env.FIREBASE_CLIENT_EMAIL &&
            process.env.FIREBASE_PRIVATE_KEY) ||
          process.env.FIRESTORE_EMULATOR_HOST
        ) &&
        !!process.env.SESSION_SECRET &&
        process.env.SESSION_SECRET.length >= 32 &&
        !!process.env.ADMIN_KEY;
      if (!configured)
        return NextResponse.json(
          {
            ready: false,
            message: "Local play works. Online services need configuration.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      try {
        await db().doc("stats/global").get();
        return NextResponse.json(
          { ready: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return NextResponse.json(
          { ready: false, message: "Database connection failed." },
          { status: 503 },
        );
      }
    }
    const store = db();
    if (path === "stats" && req.method === "GET") {
      const doc = await store.doc("stats/global").get();
      return NextResponse.json(doc.data() || { totalWoken: 0 }, {
        headers: { "Cache-Control": "public, max-age=30" },
      });
    }
    if (path === "leaderboard" && req.method === "GET") {
      const dept = req.nextUrl.searchParams.get("type") === "departments";
      const mode = req.nextUrl.searchParams.get("game") || "classic";
      if (!validBoard(mode)) throw Error("Unknown game.");
      const limit = Math.min(
        50,
        Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50),
      );
      const key = dept ? "departments" : mode;
      const snap = await boards.get(store, key, dept, mode);
      return NextResponse.json(
        {
          rows: snap.rows.slice(0, limit),
          current: null,
          updatedAt: snap.at,
          stale: snap.stale || false,
        },
        {
          headers: {
            // Cached at the edge so many viewers polling share one Firestore read.
            "Cache-Control": snap.stale
              ? "public, s-maxage=30, stale-while-revalidate=86400"
              : "public, s-maxage=60, stale-while-revalidate=86400",
          },
        },
      );
    }
    // The player's own row is per-person, so it stays out of the shared board
    // response; the client asks for it once per visit instead of every poll.
    if (path === "leaderboard/me" && req.method === "GET") {
      const mode = req.nextUrl.searchParams.get("game") || "classic";
      if (!validBoard(mode)) throw Error("Unknown game.");
      let current = null;
      try {
        const id = await owner(),
          p = await store.doc(`players/${id}`).get();
        const personalBest =
          mode === "classic"
            ? p.data()?.bestScore
            : p.data()?.bestScores?.[mode];
        if (
          p.exists &&
          !p.data()!.banned &&
          typeof personalBest === "number" &&
          personalBest > 0
        ) {
          const snap = await boards.get(store, mode, false, mode);
          const placed = snap.rows.findIndex(
            (r: { id?: string }) => r.id === id,
          );
          current = {
            id,
            nickname: p.data()!.nickname,
            department: p.data()!.department,
            bestScore: personalBest,
            // Inside the snapshot the rank is free; below it, one count query.
            rank:
              placed >= 0
                ? placed + 1
                : (
                    await playersBy(store, mode)
                      .above(personalBest)
                      .count()
                      .get()
                  ).data().count + 1,
          };
        }
      } catch {}
      return NextResponse.json(
        { current },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const b = req.method === "POST" ? await req.json() : {};
    if (path === "player" && req.method === "POST") {
      const nickname = validNickname(b.nickname);
      if (!campaign.departments.includes(b.department))
        throw Error("Department select karo.");
      let id: string;
      try {
        id = await owner();
      } catch {
        id = randomUUID();
      }
      const ref = store.doc(`players/${id}`);
      const playerCookie = sign({ kind: "player", id });
      await store.runTransaction(async (tx) => {
        const old = await tx.get(ref);
        if (old.exists && old.data()!.banned)
          throw Error("Player submissions blocked.");
        if (old.exists) {
          tx.update(ref, { nickname, updatedAt: Date.now() });
        } else {
          const dep = store.doc(`departments/${b.department}`),
            global = store.doc("stats/global");
          const [d, g] = await Promise.all([tx.get(dep), tx.get(global)]);
          tx.set(ref, {
            nickname,
            department: b.department,
            bestScore: 0,
            bestScores: {},
            totalWoken: 0,
            plays: 0,
            cardsCollected: 0,
            cards: [],
            banned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          tx.set(dep, {
            name: b.department,
            totalWoken: d.data()?.totalWoken || 0,
            playerCount: (d.data()?.playerCount || 0) + 1,
          });
          tx.set(global, {
            totalPlays: g.data()?.totalPlays || 0,
            totalWoken: g.data()?.totalWoken || 0,
            uniquePlayers: (g.data()?.uniquePlayers || 0) + 1,
          });
        }
      });
      (await cookies()).set("jaago-player", playerCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 31536000,
      });
      return NextResponse.json({
        id,
        nickname,
        department: (await ref.get()).data()!.department,
      });
    }
    if (path === "session/start" && req.method === "POST") {
      const mode = b.mode || "classic";
      if (!validBoard(mode)) throw Error("Unknown game.");
      if (mode === "dash") {
        // Runs restart every few seconds, so Dash tokens cost no writes and
        // players may pick a nickname after a good run.
        const playerId = await owner().catch(() => null);
        return NextResponse.json({
          token: sign({
            kind: "round",
            tokenId: randomUUID(),
            playerId,
            startedAt: Date.now(),
            mode,
          }),
        });
      }
      const playerId = await owner(),
        ref = store.doc(`players/${playerId}`),
        tokenId = randomUUID(),
        startedAt = Date.now();
      await store.runTransaction(async (tx) => {
        const p = await tx.get(ref);
        if (!p.exists || p.data()!.banned)
          throw Error("Player submissions blocked.");
        if (startedAt - (p.data()!.lastSessionAt || 0) < 5000)
          throw Error("Thora ruk kar dobara khelo.");
        tx.update(ref, { lastSessionAt: startedAt });
        tx.set(store.doc(`sessions/${tokenId}`), {
          playerId,
          startedAt,
          used: false,
          mode,
        });
      });
      return NextResponse.json({
        token: sign({ kind: "round", tokenId, playerId, startedAt, mode }),
      });
    }
    if (path === "score" && req.method === "POST") {
      const session = verify(b.token),
        id = await owner();
      const mode = session.mode || "classic";
      if (
        session.kind !== "round" ||
        (session.playerId !== id && !(mode === "dash" && !session.playerId))
      )
        throw Error("Invalid session.");
      validateScore(b, Date.now() - session.startedAt, mode);
      const pRef = store.doc(`players/${id}`),
        sRef = store.doc(`sessions/${session.tokenId}`);
      await store.runTransaction(async (tx) => {
        const [p, s, g] = await Promise.all([
          tx.get(pRef),
          tx.get(sRef),
          tx.get(store.doc("stats/global")),
        ]);
        if (
          (mode === "dash" ? s.exists : !s.exists || s.data()!.used) ||
          !p.exists ||
          p.data()!.banned
        )
          throw Error("Session used or player blocked.");
        const player = p.data()!,
          dep = store.doc(`departments/${player.department}`),
          d = await tx.get(dep);
        const hour = Math.floor(Date.now() / 3600000),
          count = player.scoreHour === hour ? player.hourCount || 0 : 0;
        if (count >= (mode === "dash" ? 90 : 40))
          throw Error("Hourly limit reached. Baad mein dobara khelo.");
        const safeCards = validatedCards(b, mode);
        const all = [...new Set([...(player.cards || []), ...safeCards])];
        if (mode === "dash")
          tx.set(sRef, {
            playerId: id,
            startedAt: session.startedAt,
            used: true,
            mode,
          });
        else tx.update(sRef, { used: true });
        tx.update(pRef, {
          bestScore:
            mode === "classic"
              ? Math.max(player.bestScore, b.score)
              : player.bestScore,
          bestScores: {
            ...(player.bestScores || {}),
            [mode]: Math.max(player.bestScores?.[mode] || 0, b.score),
          },
          totalWoken: player.totalWoken + (b.woken || 0),
          plays: player.plays + 1,
          cards: all,
          cardsCollected: all.length,
          updatedAt: Date.now(),
          scoreHour: hour,
          hourCount: count + 1,
        });
        tx.set(dep, {
          name: player.department,
          totalWoken: (d.data()?.totalWoken || 0) + (b.woken || 0),
          playerCount: d.data()?.playerCount || 1,
        });
        tx.set(store.doc("stats/global"), {
          ...g.data(),
          totalPlays: (g.data()?.totalPlays || 0) + 1,
          totalWoken: (g.data()?.totalWoken || 0) + (b.woken || 0),
        });
        tx.set(store.collection("scores").doc(), {
          playerId: id,
          mode,
          hits: b.hits || 0,
          pairs: b.pairs || 0,
          votes: b.votes || 0,
          distance: b.distance || 0,
          mistakes: b.mistakes || 0,
          score: b.score,
          woken: b.woken || 0,
          pops: b.pops || 0,
          maxCombo: b.maxCombo || 0,
          powerupsUsed: b.powerupsUsed || 0,
          durationMs: b.durationMs,
          earlyEnd: b.earlyEnd ?? true,
          createdAt: Date.now(),
        });
      });
      // The shared board is not rebuilt here: doing that on every new best is
      // what exhausted the read quota. It picks the score up within 90 seconds,
      // and the player's own rank is returned below straight away.
      const p = await pRef.get();
      const board = playersBy(store, mode);
      const best =
        mode === "classic" ? p.data()!.bestScore : p.data()!.bestScores[mode];
      const [rank, total] = await Promise.all([
        board.above(best).count().get(),
        board.ranked().count().get(),
      ]);
      return NextResponse.json({
        rank: rank.data().count + 1,
        total: total.data().count,
      });
    }
    if (path === "challenge" && req.method === "POST") {
      const mode = b.mode || "classic";
      if (!validBoard(mode)) throw Error("Unknown game.");
      const id = await owner(),
        p = await store.doc(`players/${id}`).get();
      if (!p.exists || p.data()!.banned) throw Error("Player unavailable.");
      const best =
        mode === "classic" ? p.data()!.bestScore : p.data()!.bestScores?.[mode];
      if (typeof best !== "number" || p.data()!.plays < 1)
        throw Error("Pehle ek score save karo.");
      const c = code();
      await store.doc(`challenges/${c}`).create({
        playerId: id,
        nickname: p.data()!.nickname,
        score: best,
        mode,
        createdAt: Date.now(),
      });
      return NextResponse.json({ code: c, score: best, mode });
    }
    if (path.startsWith("admin")) {
      const supplied =
          req.headers.get("authorization")?.replace(/^Bearer /, "") || "",
        expected = process.env.ADMIN_KEY;
      if (
        !expected ||
        supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        return NextResponse.json(
          { error: "Admin key check karo." },
          { status: 401 },
        );
      if (req.method === "GET") {
        const [stats, scores] = await Promise.all([
          store.doc("stats/global").get(),
          store
            .collection("scores")
            .orderBy("createdAt", "desc")
            .limit(30)
            .get(),
        ]);
        return NextResponse.json({
          stats: stats.data(),
          scores: scores.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      }
      if (typeof b.id !== "string" || !/^[\w-]{1,100}$/.test(b.id))
        throw Error("Invalid record.");
      if (b.action === "ban")
        await store.doc(`players/${b.id}`).update({ banned: true });
      else if (b.action === "rename")
        await store
          .doc(`players/${b.id}`)
          .update({ nickname: validNickname(b.nickname) });
      else if (b.action === "delete") {
        const ref = store.doc(`scores/${b.id}`);
        await store.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists) throw Error("Score already removed.");
          const data = s.data()!,
            pRef = store.doc(`players/${data.playerId}`),
            p = await tx.get(pRef);
          const player = p.data()!,
            dep = store.doc(`departments/${player.department}`),
            global = store.doc("stats/global");
          const [d, g, remaining] = await Promise.all([
            tx.get(dep),
            tx.get(global),
            tx.get(
              store.collection("scores").where("playerId", "==", data.playerId),
            ),
          ]);
          const best = Math.max(
            0,
            ...remaining.docs
              .filter(
                (x) =>
                  x.id !== b.id &&
                  (x.data().mode || "classic") === (data.mode || "classic"),
              )
              .map((x) => x.data().score),
          );
          tx.delete(ref);
          tx.update(pRef, {
            bestScore:
              (data.mode || "classic") === "classic" ? best : player.bestScore,
            bestScores: {
              ...(player.bestScores || {}),
              [data.mode || "classic"]: best,
            },
            totalWoken: Math.max(0, player.totalWoken - data.woken),
            plays: Math.max(0, player.plays - 1),
          });
          tx.update(dep, {
            totalWoken: Math.max(0, (d.data()?.totalWoken || 0) - data.woken),
          });
          tx.update(global, {
            totalWoken: Math.max(0, (g.data()?.totalWoken || 0) - data.woken),
            totalPlays: Math.max(0, (g.data()?.totalPlays || 0) - 1),
          });
        });
      } else throw Error("Unknown action.");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Route nahi mila." }, { status: 404 });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Request failed. Dobara try karo.",
      },
      { status: 400 },
    );
  }
}
export const GET = handle;
export const POST = handle;
