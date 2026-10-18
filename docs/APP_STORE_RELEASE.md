# Raahi App Store release plan

This is the release checklist for the iOS App Store submission. It separates repository-verified work from work that requires an Apple Developer account, production hosting, or a real device.

## Current build identity

| Item | Value |
|---|---|
| Product | Raahi |
| Bundle ID | `com.raahi.travel` |
| Expo project | `@shivbu22/raahi` |
| EAS project ID | `3ed32386-7407-4bc1-8962-b98ba063fa2b` |
| SDK | Expo 57 / React Native 0.86 |
| Minimum iOS | 16.4 in the current EAS simulator artifact |
| Native build route | EAS Build; xtool is installed for SwiftPM projects but does not build React Native/Expo projects |

EAS simulator build `59f6b290-e287-4954-ac32-5d5b056d1218` finished successfully. The downloaded archive SHA-256 is `98d78bf0a739f46403c42cf877b4df3a5a11a2c9a9198cdc32ba89031268e4ab`. Its artifact validates native compilation and bundle packaging; it is not installable on a physical iPhone or submit-able to the App Store.

## Required external setup

1. Enroll in the paid Apple Developer Program and accept the current agreements.
2. Create the App Store Connect app with bundle ID `com.raahi.travel`.
3. Configure EAS iOS credentials through `eas credentials --platform ios`. Keep certificates, provisioning profiles, API keys, and Apple private keys out of source control and chat.
4. Choose public HTTPS hosting for the API and legal/support pages. The API must expose `/v1/health`, return `production: true`, use managed PostgreSQL, persistent object storage, Twilio Verify, and valid Apple credentials.
5. Publish privacy policy, terms of use, support, and account-deletion information on public HTTPS URLs. The web artifact includes `/privacy.html`, `/terms.html`, `/support.html`, and `/delete-account.html`; update the contact details and deploy them behind the chosen public domain.
6. Set production secrets in the server secret manager:
   - `DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`
   - `AUTH_MODE=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
   - `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_TOKEN_ENCRYPTION_KEY`
   - `PUBLIC_URL`, `CLIENT_ORIGIN`, `SUPPORT_EMAIL`
7. Configure an App Review account or review-safe login path that does not expose development OTP codes. It must reach discovery, matching, chat, safety, export, and deletion.

Configure Apple’s Sign in with Apple server-to-server notification URL as `https://<api-domain>/v1/auth/apple/notifications`. Apple posts its signed JWS in the `payload` field; the endpoint verifies the signed payload and clears the stored Apple authorization when consent is revoked or Apple reports account deletion.

## Production build command

From `mobile/`, after setting the public build variables in the local shell or EAS environment:

```powershell
$env:EAS_BUILD_PROFILE="production"
$env:RAAHI_RELEASE_CHANNEL="production"
$env:EXPO_PUBLIC_API_URL="https://api.example.com/v1"
$env:EXPO_PUBLIC_PRIVACY_URL="https://example.com/privacy"
$env:EXPO_PUBLIC_TERMS_URL="https://example.com/terms"
$env:EXPO_PUBLIC_SUPPORT_URL="https://example.com/support"
$env:EXPO_PUBLIC_SUPPORT_EMAIL="support@example.com"
eas build --platform ios --profile production --wait
```

Before starting the build:

```powershell
npm --workspace @raahi/mobile run check:production
npm --workspace @raahi/mobile exec -- expo-doctor
```

The production config rejects LAN addresses, HTTP, placeholder domains, query strings, and missing legal/support values. It removes the local ATS exception and enables Apple Sign In. The preview/simulator profile keeps local networking for development only.

## App Store metadata draft

Replace the support/legal placeholders and approve the claims before entering App Store Connect.

- **Name:** Raahi
- **Subtitle:** Find your travel people
- **Primary category:** Social Networking
- **Secondary category:** Travel
- **Keywords:** travel buddy,travel partner,solo travel,travel dating,trip friends,meet travelers,India travel
- **Promotional text:** Plan the same trip. Find someone who gets your pace.
- **Support URL:** owner-provided public support URL
- **Privacy policy URL:** owner-provided public privacy URL
- **Age rating:** choose the honest rating for adult dating, user-generated photos, private messaging, and reports; do not market this as a Kids app.

### Description draft

Raahi helps adults find someone worth going somewhere with.

Start with a real trip: destination, dates, budget, pace, travel styles, and intent. Build a profile with your photos and prompts. Discover travelers whose plans overlap, see why the trip may fit, and send interest on the profile, a photo, a prompt, or the trip itself.

Chat opens only after mutual interest. Keep the shared trip context in view, use conversation starters when useful, and take the first meeting slowly: video call first, meet in public, and keep your own way home.

Raahi includes phone or Apple sign-in, profile and selfie review, block and report controls, private safety reports, optional location and contacts tools, message notifications, data export, and in-app account deletion.

Raahi does not sell address books or precise location. Verification selfies are private. Text chat is part of the current release; payments, boosts, voice notes, itinerary tools, and AI recommendations are not part of this version.

## Privacy Nutrition Label preparation

Confirm this mapping against final production data flows and every vendor. Apple requires declaration of data collected by the app and third-party partners, whether it is linked to the user, and whether it is used for tracking.

| Data type | Linked | Purpose | Notes |
|---|---:|---|---|
| Phone number | Yes | App functionality | OTP sign-in and account recovery |
| Name / user ID | Yes | App functionality, personalization | Profile and server-owned account identity |
| Photos or videos | Yes | App functionality | Profile photos, Journal photos, optional selfie review |
| Sensitive info | Yes | App functionality | Identity-review selfie and adult profile preferences; confirm exact Apple category |
| Precise location | Yes | App functionality | Optional city confirmation; exact coordinates stay private |
| Contacts | No collection by Raahi | N/A | Contacts remain on-device for invitations; verify provider behavior |
| Emails or text messages | Yes | App functionality | In-app private chat messages |
| Other user content | Yes | App functionality | Bio, prompts, trip descriptions, captions, comments, reports |
| Device ID / push token | Review with provider | App functionality | Declare if the final push provider treats the token as a device identifier |
| Crash/analytics data | No current SDK | N/A | Recheck the final dependency tree |

**Tracking:** none is intentionally implemented. There is no advertising or analytics SDK in the current source.


## Screenshot and review assets

Apple requires at least one iPhone screenshot for a Dynamic Island medium display and one iPad 13-inch screenshot when the app supports iPadOS. The app declares tablet support. Capture the final native build on supported simulators or a real device; do not submit web screenshots as native evidence.

Recommended capture set:

1. Welcome / trip-specific value proposition.
2. Onboarding trip passport with destination and dates.
3. Discovery card showing overlap, budget, pace, and trust context.
4. Profile prompt/photo interaction with contextual like.
5. Mutual match and safety-first chat controls.
6. Settings showing verification, export, delete, report, and block controls.

Use fictional review accounts and fictional profile data. Do not include seeded development accounts, phone numbers, development OTPs, local IP addresses, or placeholder URLs.

## Review notes draft

> Raahi is an adult travel-connection app. The reviewer can sign in with the supplied review account, open a trip, view discovery, send interest, accept a mutual interest, use text chat, open report/block controls, export account data, and cancel or confirm account deletion. Development OTP display is disabled in this build. Location, contacts, camera, photo library, notifications, and Apple Sign In are optional and requested only when the reviewer opens the related action. Account deletion is available in Settings → Your data and removes the account and associated user content after final confirmation.

Provide exact review credentials and any staging API availability window in App Store Connect, never in this repository.

## Final gate

- Production API and public legal/support URLs pass `mobile/scripts/check-production.mjs`.
- `AUTH_MODE=twilio` and no development OTP appears in the production bundle or API responses.
- Apple authorization-code exchange and refresh-token revocation are configured and tested with real Apple credentials.
- Apple server-to-server notifications are configured and tested against the public HTTPS API.
- Live Twilio, Apple Sign In, photo/camera, selfie review, notifications, location, contacts, export/share, deep links, accessibility, offline/retry, and deletion are tested on a physical iPhone.
- The signed EAS production build passes App Store Connect processing and TestFlight internal testing.
- Privacy labels, age rating, screenshots, description, support URL, privacy URL, terms URL, review notes, and export compliance answers are complete and accurate.
