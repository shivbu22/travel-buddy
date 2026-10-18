# Raahi mobile

Expo/React Native iOS-first vertical slice for the Raahi travel companion app.

## Run

```bash
npm install
npm start
```

Use `i` for an iOS simulator or scan the QR code with Expo Go. Start PostgreSQL and the API first for the complete flow:

```text
Welcome → phone OTP → profile/photos → trip → server-filtered discovery → mutual match → persisted chat → settings/report/block
```

## Validation

```bash
npm run typecheck
npm test
npx expo export --platform ios
npx expo-doctor
```

The app stores only drafts and session tokens on-device. Profile, trips, mutual interests, messages, reports, and blocks use the API in `../server`. `mobile/.env` is configured for the current computer LAN address (`192.168.1.7`) so a phone on the same Wi-Fi can reach the API. If that address changes, update `EXPO_PUBLIC_API_URL`; use `http://localhost:4000/v1` for an iOS simulator.

New profiles must upload 3–6 photos before they can enter discovery. The development OTP is displayed by the login screen; production uses the configured SMS provider. A native development build is required for Apple Sign In and push notifications.

Permission behavior is opt-in: photo library access is requested when adding photos, camera access when taking the identity selfie, precise foreground location when using “Use my current location,” and contacts only when choosing “Find friends to invite.” Exact coordinates and contact records are not used for discovery.

New accounts must submit a selfie review after uploading 3 photos. Profiles remain out of discovery until an authorized reviewer approves the check. Review queue endpoints are available under `/v1/admin/verifications` and require `ADMIN_TOKEN`.

If the API works on the computer but not on a physical phone, run PowerShell as Administrator once:

```powershell
New-NetFirewallRule -DisplayName "Raahi API 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private
```
