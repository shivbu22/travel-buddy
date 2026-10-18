# Raahi

> Meet someone worth going somewhere with.

Raahi is an India-first, travel-focused dating app. People build intentional profiles, share upcoming destinations, discover compatible travelers, like a photo or prompt, and chat after a mutual match.

## Project status

**Phase:** iOS MVP vertical slice / native simulator build verified; App Store production setup pending Apple credentials and public hosting

**Build order:** iOS first, Android-ready architecture from day one

**Application source:** `mobile/`

**Security/design references:** [`docs/MASVS_AUDIT.md`](docs/MASVS_AUDIT.md) · [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) · [`LOOP.md`](LOOP.md)

## What is decided

- The launch experience is trip-specific dating, not open-ended anonymous swiping.
- The discovery card always shows destination, dates, budget, travel-style tags, and trust signals.
- Mutual interest is required before chat.
- Phone verification is required for core actions; stronger verification is additive.
- Text chat is in the launch scope. Voice notes, payments, boosts, itinerary tools, and AI recommendations are post-launch.
- Server-side policies enforce safety preferences and block relationships.
- iOS is the first release target; Android uses the same domain model and component contracts later.

## Run the full stack

```bash
npm install
npm run db:up
npm run db:setup
npm run server:dev
```

In a second terminal:

```bash
npm --workspace @raahi/mobile start
```

The development API returns the OTP in the response and the mobile login screen displays it. For a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN address, for example `http://192.168.1.20:4000/v1`, before starting Expo. Production requires Twilio Verify, Apple Sign In token-revocation credentials, HTTPS, a random JWT secret, public legal/support URLs, and object storage or the included upload volume. See [`docs/APP_STORE_RELEASE.md`](docs/APP_STORE_RELEASE.md) for the full submission sequence.

### Physical iPhone test run

Use the computer's current Wi-Fi IPv4 address in `mobile/.env` and keep the protocol as plain `http` for the local API:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.7:4000/v1
```

After changing this value, stop Expo Go, restart Metro with a cleared cache, and reload the QR session. The app normalizes a stale local `https://` value back to `http://`, but the fresh Metro session is still required for the new bundle to reach the phone. In Settings → App connection, the app displays the active API host and can test the API/database health.

Start the local stack from PowerShell on Windows:

```powershell
npm run db:up
npm run db:setup
npm run build
npm --workspace @raahi/server run start
```

In a second PowerShell window:

```powershell
npm --workspace @raahi/mobile start -- --lan --clear
```

If Expo is slow to become reachable on Windows/OneDrive, use the lower-worker LAN command instead. It keeps Metro's cache so normal restarts are fast:

```powershell
npm run mobile:lan
```

Metro can take 1–3 minutes after a full cache clear on the first launch. Wait until `http://<computer-ip>:8081` responds before scanning the QR code; the API and Expo ports are separate (`4000` and `8081`).

Use `npm --workspace @raahi/mobile start -- --lan --clear --max-workers 2` only after changing environment variables or when Metro reports a stale bundle.

The local health response includes `status: "ok"` and `database: "ok"`. Profile images are uploaded as resized JPEGs to `POST /v1/me/photos` and served from `http://<computer-ip>:4000/uploads/`.

The web export is a single-page app. Deploy `mobile/dist-web` with an SPA fallback to `index.html`; Netlify and Vercel rules are included in `mobile/public/_redirects` and `mobile/vercel.json`.

## Product flow

1. **Decide where to go:** use destination suggestions or enter any city/country, dates, budget, flexibility, and travel style.
2. **Find a partner who fits the trip:** discovery requires an approved profile, mutual safety compatibility, matching destination, and at least three overlapping days.
3. **Match the vibe:** like the profile, a prompt, or a photo with an optional opening line. Chat opens only after mutual interest.
4. **Meet and plan safely:** chat keeps the shared trip context visible; meet in public, take a video call first, and keep independent transport and accommodation.
5. **Post the journey:** Journal supports one-to-six travel photos, captions, destination context, likes, comments, and private story reporting. Exact live location and accommodation are never posted.

Inbound interests appear in Matches with the sender's trip, recipient trip, target context, compatibility reasons, and explicit **Like back** or **Pass** actions. Both actions are server-authoritative and survive reloads.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm --workspace @raahi/mobile run export:ios
npm --workspace @raahi/mobile run export:web
npm --workspace @raahi/mobile exec -- expo-doctor
npm run smoke:api
npm --workspace @raahi/server run test:e2e
```

Web and iOS exports intentionally use separate output folders: `mobile/dist-web/` and `mobile/dist-ios/`.

`Travel_Buddy_COMPLETE_MASTER_PROMPT.md` describes a non-dating companion positioning while this README defines Raahi as travel-focused dating. The implementation preserves the README launch decision and keeps intent explicit in the profile contract until that product decision is reconciled.
