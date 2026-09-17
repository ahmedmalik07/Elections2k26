# Verification record

## Verified locally

- Production build passed with 123 kB first-load JavaScript. All 14 automated tests passed. Dependency audit found zero vulnerabilities.
- HTTP smoke checks returned 200 for all pages, every game URL, the manifest, app icon, Open Graph image and supplied portrait. An invalid score request returned 400; the health endpoint correctly reported that Firebase still needs configuration.

- TypeScript checks and automated tests cover original round timing, early loss, single completion, splash wakeups, combos, heavy clouds, easy mode with no early loss, nickname filtering, game-specific score formulas, mode/session mismatch, six-pair shuffling and server-derived mini-game card unlocks.
- Completed Chai & Code in the browser at 360x740: target moves after a tap, points accumulate, the round reaches its result, the device best is saved and the profile card unlocks.
- Completed Dev Match in the browser at 360x740: six mismatches followed by six correct pairs produced 360 points, a completion result and the remaining three campaign cards. Download card reported success. Replay reset the score and board.
- Reloaded `/ahmed` and verified the collection remained 4/4 with the cards readable.
- Checked Ahmed's supplied photo, full name, GDGOC role and credential grid at 430x932. The actual image is served from `public/ahmed.png`.
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
