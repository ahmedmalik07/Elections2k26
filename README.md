# Elections2k26 — Jaago Campus

The homepage now opens directly into **Campus Dash**, an original three-lane runner set on the E-9 campus (Margalla Hills, Faisal Mosque, flag bunting, black-and-yellow kerbs). The player wears Ahmed's jersey (name + roll number), runs past billboards with his photo, collects votes, jumps pink QUIZ hurdles, dodges blue DEADLINE walls and grabs chai for a one-crash shield. Milestones surface Ahmed's credentials, and a countdown shows the days left to vote. Swipe, use arrow keys / Space, or tap the large controls. No signup is needed to play; after a new best, players can pick a nickname to put it on the live Campus Dash leaderboard. `/run` also opens the runner, while existing challenge links retain their original game flow. The other games remain at `/arcade`.

A mobile arcade for Ahmed Malik's independent student VP campaign, with a GDGOC/CS theme and his supplied portrait. Start with **[LAUNCH.md](LAUNCH.md)** for the step-by-step guide to Firebase, GitHub, Vercel and the custom domain.

Four choices: **Chill Campus** (easy cloud popping, no early loss), **Chai & Code** (30-second one-tap game), **Dev Match** (six pairs of HTML/CSS/JS/Git/API/CLI cards), and **Bore Buster** (the original 45-second challenge). Every game has its own server leaderboard and device best score. Full leaderboards retain up to 250 ranked players per game; compact cards request only their top scores. All campus art and game icons are code-drawn; the candidate photo is supplied by Ahmed. Playable locally without Firebase; shared scores, challenges, totals and admin require Firebase.

## Local setup

Node.js 20.9+ is required. Run `npm install`, copy `.env.example` to `.env.local`, then run `npm run dev`. Open http://localhost:3000. Run `npm run build`, `npm run typecheck` and `npm test` for checks. Development uses `.next-dev`; production builds use `.next`, so checking a build does not overwrite the running preview. With a server running, `npm run smoke` checks public routes and the configuration health endpoint.

## Firebase

Create a Firebase project and a Firestore database. In Project settings > Service accounts generate an Admin SDK private key. Keep it private. Put its project ID, client email and private key in `.env.local` using the variables below. Use a quoted private key with escaped newlines. Deploy `firestore.rules` and `firestore.indexes.json` with the Firebase CLI (`firebase deploy --only firestore --project YOUR_PROJECT_ID`). All browser database reads and writes are denied; Next.js server routes use the Admin SDK.

Environment variables:

| Variable              | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| FIREBASE_PROJECT_ID   | Firebase project ID                                                        |
| FIREBASE_CLIENT_EMAIL | Service account email                                                      |
| FIREBASE_PRIVATE_KEY  | Service account private key with escaped newlines                          |
| SESSION_SECRET        | Random secret of at least 32 characters                                    |
| ADMIN_KEY             | Separate long random admin password                                        |
| NEXT_PUBLIC_SITE_URL  | http://localhost:3000 locally; https://ahmedmalik.wyibe.com for deployment |

Generate separate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never put secrets in a public environment variable or commit `.env.local`.

## Leaderboards and the free quota

Firebase's free plan allows 50,000 reads and 20,000 writes a day, and hitting that limit makes every leaderboard fail until it resets at midnight US Pacific time. Boards are therefore never drawn by reading one document per player. Each board is a single cached snapshot (`lib/boardCache.mjs`): a new best score writes itself into `boards/<mode>`, and a full rescan of the players is only a repair, every three hours or after an admin ban, rename or deletion.

Optionally, and for free, **Upstash Redis** can serve the boards so they no longer depend on the Firebase quota at all. Firestore stays the record of every player and score; Redis holds only what a board needs to be drawn, as one sorted set per game. Reading a board costs 2 Redis commands and saving a score costs 2, against a free allowance of 500,000 a month with no credit card.

To turn it on: create a free database at [upstash.com](https://upstash.com), copy the two REST values into `.env.local` and into Vercel's environment variables, then run `npm run sync:redis` once to copy the existing boards across.

| Variable                 | Value                                                           |
| ------------------------ | --------------------------------------------------------------- |
| UPSTASH_REDIS_REST_URL   | `https://....upstash.io`, from the database page under REST API |
| UPSTASH_REDIS_REST_TOKEN | the matching token on that page                                 |

With these unset, everything runs from Firestore exactly as before. If Upstash is ever unreachable, the boards fall back to Firestore automatically.

`npm run backup` writes every player, score and leaderboard to `backups/`, along with a readable `top-players-*.txt` list for choosing prize winners. That folder is never committed. Run it during voting days so the results exist outside Firebase.

## Deploy

Import the repository into Vercel as a Next.js application and set all six environment variables for the intended environment. Deploy after verifying your Firebase configuration. Add `ahmedmalik.wyibe.com` in Vercel project settings. In wyibe.com DNS add a CNAME named `ahmedmalik` pointing to the exact target Vercel supplies. Verify the domain and HTTPS in Vercel. Hosting and domain changes are not performed by this source project.

## Campaign edits

Edit `config/campaign.ts` for candidate details, department names, voting date, ballot number, site URL, proof visibility and manifesto cards. Blank ballot/date values are hidden. The current game is balanced around a 45-second round; changing duration requires matching server validation. The optional portrait is supported by placing `ahmed-speaking.jpg` in `public`; without it a code-drawn avatar appears.

Routes: `/`, `/run`, `/arcade`, `/play?game=easy|chai|memory|classic`, `/ahmed`, `/leaderboard?game=dash|easy|chai|memory|classic`, `/print`, `/admin`. Use `/play?game=classic&debug=1` to display FPS, spawn interval and score event counts. `/print` generates a real QR code and an A4 print layout. Sound starts muted; the choice is saved on this device. `/api/health` reports whether the online configuration and Firestore connection are ready, without returning secrets. `npm run setup -- "path/to/service-account.json" "https://your-domain"` safely creates a new `.env.local` with independent generated secrets.

## Local test data

Start the Firebase emulator for `demo-jaago-campus`. Set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and run `node scripts/seed.mjs`. The script refuses a non-local emulator host. Never run this against production. Demo names are explicitly labeled, and no demo scores appear in the normal offline experience.

## Security and operating notes

Player ownership uses a signed HttpOnly cookie; local storage holds the display profile, collection and game-specific personal bests. Tokens are HMAC signed, single use and bound to that cookie and game mode. Server elapsed time, duration, numeric bounds, score ceilings and a 40-per-hour submission limit are checked before an atomic score update. Mini-game totals must match their scoring formulas; campaign card unlocks for those games are derived server-side from performance. A short start-session cooldown prevents rapid session creation. Bans block session starts, score submissions and challenge creation. Admin score deletion recalculates that game's best and subtracts affected totals. Classic scores retain the legacy `bestScore` field; additional games use `bestScores.easy`, `.chai` and `.memory`. Department and global students-woken totals count cloud rounds, while all modes count toward plays.

Client-side games cannot prove honest play from an aggregate score. These checks reject malformed and implausible scores, but a determined player can forge plausible play with a valid session. A fully authoritative or replay-verified simulation is a future hardening step. Rate limiting is per browser identity, not a guarantee against identity rotation. Server records include operational timestamps and session tokens; no contact details or student roll numbers are requested.

Live leaderboards (Campus Dash page, arcade tabs, every result screen and `/leaderboard`) poll every 15 seconds; the API caches each board for 10 seconds per server instance to limit Firestore reads. Campus Dash tokens cost no writes, only new personal bests are submitted, and its queries use single-field indexes (no index deploy needed). Missing Firebase displays an explicit error and does not invent rankings. Local play and card collection still work. Challenge links represent the player's best saved score. The admin key stays in sessionStorage. Clearing browser storage can lose the local collection/profile.

## Verification scope

See `TESTING.md` for performed checks and remaining external/device verification. Real Firebase transactions, production WhatsApp previews, iOS Safari, Android devices and Lighthouse must be verified against a configured deployment before calling this production-ready.
