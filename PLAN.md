# Jaago Campus build plan

Use Next.js App Router for landing, play, manifesto, leaderboard, print and admin screens. Shared campaign copy and settings live in config/campaign.ts. A standalone canvas engine owns the fixed-timestep simulation, drawing, input and sound. React owns navigation, nickname entry and results.

The engine tracks twelve students, approaching clouds, particles, timed power-ups and score events. Visibility changes pause simulation; 45 active seconds completes a round. Local storage keeps the nickname, random device identifier, mute and collection. Server-issued sessions gate submissions. Firestore transactions update players, scores, department totals and global totals together. All direct database access is denied.

Build and typecheck, exercise validation tests, then inspect mobile layouts and a full round in a browser. External deployment, real devices, Firebase integration and WhatsApp unfurl checks require configured services and must be reported separately.
