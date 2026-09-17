# Put Jaago Campus online

The arcade, Ahmed's profile and supplied photo are ready in this project. A local preview is not a public website. Use the steps below to connect shared scores and publish it.

## 1. Confirm your public details

Open `config/campaign.ts`. The position is **Vice President, GDGOC Air University**, and voting is set to **21 and 22 September 2026**, in Pakistan time. Confirm the department names, LinkedIn URL and promises. Add your ballot number when confirmed; a blank number stays hidden. Your supplied portrait is `public/ahmed-speaking.jpg`. The profile shows the credentials you supplied: Computer Games Development, 4 national hackathon wins, a startup incubated at NIC Islamabad, 5 internships and Technical Co-Lead at GDGOC Air University. No startup name, academic year or contact details have been invented.

## 2. Create Firebase

1. Open https://console.firebase.google.com/ and create a project.
2. Open **Build > Firestore Database**, create the **default database**, and choose a suitable nearby location. Keep direct client access locked down.
3. In **Project settings > Service accounts**, generate a Firebase Admin SDK private key and save the JSON file privately on your computer.
4. In a terminal in this project, run:

```powershell
npm run setup -- "C:/path/to/your-service-account.json" "http://localhost:3000"
```

This writes `.env.local`, imports the Firebase settings and generates separate random session and admin secrets. It will not overwrite an existing `.env.local`. The JSON file and `.env.local` contain credentials: do not put either in the public repository or send them in chat.

5. Install/sign into the Firebase CLI and deploy this project's rules and indexes:

```powershell
npm install -g firebase-tools
firebase login
firebase deploy --only firestore --project YOUR_FIREBASE_PROJECT_ID
```

Wait for the indexes to finish building in the Firebase console. There are separate indexes for each game. The `players`, `scores`, `sessions`, `departments`, `challenges` and `stats` documents are created by play, not manually.

Restart the local server, then open http://localhost:3000/api/health. `{"ready":true}` means the required configuration exists and Firestore responded. This checks connectivity, not every game or permission flow.

## 3. Put the project on GitHub

Create a repository, then use GitHub Desktop to add this existing folder and publish it. Private is fine for Vercel. The project `.gitignore` excludes `.env` files, `.next` and `node_modules`. Check the files before your first commit: the supplied Firebase JSON must remain outside this project.

## 4. Deploy to Vercel

1. Sign into https://vercel.com/ and choose **Add New > Project**.
2. Import this GitHub repository. Keep the **Next.js** preset and default build command `npm run build`.
3. In **Settings > Environment Variables**, add these six values from `.env.local` for **Production**:

| Name | What to paste |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service-account client email |
| `FIREBASE_PRIVATE_KEY` | Entire private key, including BEGIN/END lines; literal escaped newlines or real newlines both work |
| `SESSION_SECRET` | Generated session secret |
| `ADMIN_KEY` | Generated admin secret; use this at `/admin` |
| `NEXT_PUBLIC_SITE_URL` | Your exact public HTTPS URL, without a trailing slash |

Paste values without the surrounding `.env.local` quotes. Keep all keys private except the public site URL. If you enable Preview deployments, use a separate test Firebase project and secrets for Preview.

4. Deploy. You can launch using Vercel's assigned `.vercel.app` URL first. Once the URL is known, set `NEXT_PUBLIC_SITE_URL` to that address and redeploy so metadata and QR codes use the right address. You do not need the custom domain for the first public playtest.

## 5. Connect ahmedmalik.wyibe.com

1. In Vercel **Settings > Domains**, add `ahmedmalik.wyibe.com`.
2. In the DNS account for `wyibe.com`, add a **CNAME** record with host/name `ahmedmalik`. Use the **exact target Vercel shows for this project**.
3. Wait for Vercel to verify DNS and issue HTTPS.
4. Set `NEXT_PUBLIC_SITE_URL=https://ahmedmalik.wyibe.com` and redeploy.

Do not change unrelated records on `wyibe.com`. Print QR posters only after the final domain is working.

## 6. Run the public launch check

- `/api/health` returns `ready: true`.
- On your phone, set a new Campus Dash best, save a nickname, and confirm it appears on the live board beside the game.
- On your phone, complete Chai & Code and Dev Match. Confirm scores appear on the correct game leaderboard within 15 seconds.
- Play a second round and confirm the leaderboard keeps your best score, not two player rows.
- Create a challenge and open it in another browser/device. Confirm the name, score and game agree with the saved best, and the Play button opens that game.
- Share a score image and send a challenge to yourself on WhatsApp. Check the real link preview; local previews cannot verify WhatsApp caching.
- Open `/ahmed`, confirm your photo and every credential, and read a locked card using **Abhi padh lo**.
- Visit `/admin`, enter `ADMIN_KEY`, and test rename/ban/delete using a disposable test player. A banned player must disappear from player boards and be unable to save more scores. Deleting a score recalculates the best for that game and subtracts its totals.
- Check `/print` after the final URL is set. Scan its QR on another phone before printing copies.
- Test on Android Chrome and iPhone Safari. Check sound, portrait fit, app switching, downloads and mobile sharing.

Local play is available without Firebase. Personal bests and card collection save on the device; shared ranks and server-backed challenge links require Firebase. These are separate states, and the result screen tells players which one succeeded.

## Maintenance

Push code changes to the connected production branch to trigger the next Vercel deployment. Update both your local and Vercel environment values if you rotate a secret, then redeploy. Rotating `SESSION_SECRET` invalidates existing player cookies and open round tokens. Use `/admin` for moderation and review Firebase/Vercel usage as play increases.

The score checks reject invalid sessions and impossible totals, but aggregate client-reported scores are not cheat-proof. Keep the leaderboard for bragging rights, as designed.

## Official references

- Firebase Admin SDK and service accounts: https://firebase.google.com/docs/admin/setup
- Firebase rules deployment: https://firebase.google.com/docs/rules/manage-deploy
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel custom domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain
