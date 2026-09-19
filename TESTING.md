# Verification record

Campus Dash supports a continuous run of up to 24 hours, and scores have no fixed ceiling; the permitted score scales with verified play time.

Full leaderboards retain up to 250 players per game, while the compact homepage cards request only their top 5 or 10. Redis and the Firestore fallback snapshot are seeded together by `npm run sync:redis`.

## Verified locally

- Production build passed with 123 kB first-load JavaScript. All 14 automated tests passed. Dependency audit found zero vulnerabilities.
- HTTP smoke checks returned 200 for all pages, every game URL, the manifest, app icon, Open Graph image and supplied portrait. An invalid score request returned 400; the health endpoint correctly reported that Firebase still needs configuration.

- TypeScript checks and automated tests cover original round timing, early loss, single completion, splash wakeups, combos, heavy clouds, easy mode with no early loss, nickname filtering, game-specific score formulas, mode/session mismatch, six-pair shuffling and server-derived mini-game card unlocks.
- Completed Chai & Code in the browser at 360x740: target moves after a tap, points accumulate, the round reaches its result, the device best is saved and the profile card unlocks.
- Completed Dev Match in the browser at 360x740: six mismatches followed by six correct pairs produced 360 points, a completion result and the remaining three campaign cards. Download card reported success. Replay reset the score and board.
- Reloaded `/ahmed` and verified the collection remained 4/4 with the cards readable.
- Checked Ahmed's supplied photo, full name, GDGOC role and credential grid at 430x932. The actual image is served from `public/ahmed-speaking.jpg`.
- Checked arcade navigation, game URLs, game-specific result links, and the clear local-only score message when Firebase is absent.
- Removed horizontal overflow in the mini-game frame and constrained tall result cards to an internally scrollable modal.
- Verified the GDGOC Vice President voting reminder and 21/22 September 2026 dates in the live game at 360x740. The full memory board and reminder fit with game content height equal to its visible height (599px), without internal scrolling.

## Launch checks that need external services or devices

- Firebase is not configured in this workspace. Live transactions, one-time token replay prevention against stored sessions, concurrent updates, game-specific ranking/indexes, challenge links, moderation and bans still need the configured-database checks in `LAUNCH.md`.
- The public HTTPS domain, real WhatsApp preview cache, native sharing destinations, iOS Safari, Android Chrome, vibration, audio and low-end-device performance require deployment/device checks. Opening the native share flow locally is not proof of delivery to an external app.
- Aggregate client-side score checks are not authoritative replay verification. Plausible forged scores remain a limitation, documented in the README.
- QR rendering is implemented; scan a printed code after setting the real site URL. Do not distribute localhost or an unverified domain.
- Difficulty targets and Lighthouse scores have not been measured with real users/devices.

The local game flows are working. Shared online features are implemented but remain a launch gate until the Firebase credentials, indexes and Vercel domain are connected and tested.
# Campus Dash update

The new homepage and `/run` provide the runner without signup. All 17 automated tests pass, including warmup safety, escape lanes, collision rules and score totals. Production build passes. Browser checks confirmed mobile layout at 390 × 844, starting, moving, jumping and pause/resume. The supplied speaking photo replaces the previous portrait. Real-phone performance and touch feel remain a launch playtest item.

Campus Dash redesign and live leaderboards: 21 automated tests pass (adds vote/chai/quiz/deadline collisions, rank titles, voting countdown and Dash score limits). Production build passes. Headless Chrome at 390 × 844 confirmed the candidate banner, jersey, photo billboards, milestone toast, game-over card and nickname sheet. All five leaderboard endpoints return live data; forged and anonymous score posts are rejected. A real Dash score was not submitted during testing to keep test rows off the live board.
# Score reliability repair — 19 September 2026

Confirmed the public Dash top five matched both Firestore and Redis, and fresh scores were arriving. Found a 30-minute signed-session cutoff for an endless game, volatile failed submissions lost on replay/reload, non-idempotent retries after a committed response was lost, and Redis boards bypassing snapshot reconciliation indefinitely.

Regression coverage now includes a one-hour run, delayed uploads, persistent signed submission queues, missed Redis writes, exactly-once score transactions under retry, and successful saves during Redis/rank outages. 49 tests pass. No fabricated scores were written to the production board. Old rejected scores that retained only a numeric device best cannot be authenticated or reconstructed from the database.
