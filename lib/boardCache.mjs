// Live leaderboards, kept cheap.
//
// Reading a board used to cost one Firestore read per listed player, on every
// poll by every viewer, which exhausted the free daily quota and left the boards
// blank. Each board is now stored as one `boards/<key>` document:
//   - a poll costs 1 read (often 0, served from this instance's memory),
//   - only a rebuild, at most once every BOARD_SNAPSHOT_MS, scans players,
//   - if Firestore refuses (quota, outage), the last known board is served
//     instead of an empty one.
export const BOARD_MEMORY_MS = 45000; // per-instance cache of the snapshot
export const BOARD_LIMIT = 50;
// How stale a stored board may get before it is rebuilt by scanning players.
// Player boards are kept current by the scores that write into them, so their
// rebuild is only a repair and can be rare. Department totals have no such
// writer, so that board has to be rebuilt to change at all -- it costs nothing
// until somebody actually opens the departments tab.
export const BOARD_SNAPSHOT_MS = 10800000; // 3 hours
export const DEPARTMENT_SNAPSHOT_MS = 1800000; // 30 minutes
export const rebuildAfter = (key) =>
  key === "departments" ? DEPARTMENT_SNAPSHOT_MS : BOARD_SNAPSHOT_MS;

// Campus Dash queries a single field, so it needs no composite index and
// filters bans in memory.
export function playersBy(store, mode) {
  const field = mode === "classic" ? "bestScore" : `bestScores.${mode}`;
  const players = store.collection("players");
  return {
    top: (limit) =>
      mode === "dash"
        ? players.orderBy(field, "desc").limit(limit + 10)
        : players
            .where("banned", "==", false)
            .orderBy(field, "desc")
            .limit(limit),
    above: (score) =>
      mode === "dash"
        ? players.where(field, ">", score)
        : players.where("banned", "==", false).where(field, ">", score),
    ranked: () =>
      mode === "dash"
        ? players.orderBy(field)
        : players.where("banned", "==", false).orderBy(field),
  };
}

// Firestore retries a refused read for around 20 seconds. A board would rather
// show the last scores immediately than leave a spinner on screen that long.
export function withDeadline(work, ms = 6000) {
  let timer;
  return Promise.race([
    Promise.resolve(work).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("Firestore timed out.")), ms);
    }),
  ]);
}

export async function buildBoard(store, dept, mode) {
  const docs = await (
    dept
      ? store
          .collection("departments")
          .orderBy("totalWoken", "desc")
          .limit(BOARD_LIMIT)
      : playersBy(store, mode).top(BOARD_LIMIT)
  ).get();
  return docs.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => dept || d.banned !== true)
    .map((d) =>
      dept
        ? {
            id: d.id,
            name: d.name,
            totalWoken: d.totalWoken,
            playerCount: d.playerCount,
          }
        : {
            id: d.id,
            nickname: d.nickname,
            department: d.department,
            cardsCollected: d.cardsCollected,
            bestScore: mode === "classic" ? d.bestScore : d.bestScores?.[mode],
          },
    )
    // Registering creates a 0 score; only people who actually played are listed.
    .filter((d) => dept || d.bestScore > 0)
    .slice(0, BOARD_LIMIT);
}

// A new best score edits the stored board in place, so the boards stay current
// without ever rescanning the players collection.
export function mergeRow(rows, row) {
  return [...(rows || []).filter((r) => r.id !== row.id), row]
    .filter((r) => (r.bestScore || 0) > 0)
    .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0))
    .slice(0, BOARD_LIMIT);
}

export function createBoardCache() {
  const memory = new Map();
  return {
    memory,
    async get(store, key, dept, mode, now = Date.now()) {
      const memo = memory.get(key);
      if (memo && now - memo.checkedAt < BOARD_MEMORY_MS) return memo;
      const ref = store.doc(`boards/${key}`);
      let saved;
      try {
        saved = (await withDeadline(ref.get())).data();
        if (saved?.rows && now - saved.at < rebuildAfter(key)) {
          const fresh = { at: saved.at, rows: saved.rows, checkedAt: now };
          memory.set(key, fresh);
          return fresh;
        }
        const built = {
          at: now,
          rows: await withDeadline(buildBoard(store, dept, mode), 10000),
        };
        await withDeadline(ref.set(built));
        const fresh = { ...built, checkedAt: now };
        memory.set(key, fresh);
        return fresh;
      } catch (e) {
        // Out of quota or unreachable: keep showing the last board we have and
        // try again once this instance's cache expires.
        const fallback = saved?.rows?.length ? saved : memo;
        if (!fallback) throw e;
        const stale = {
          at: fallback.at,
          rows: fallback.rows,
          checkedAt: now,
          stale: true,
        };
        memory.set(key, stale);
        return stale;
      }
    },
  };
}
