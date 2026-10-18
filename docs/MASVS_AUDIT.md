# OWASP MASVS audit — Raahi mobile

Audited: 2026-10-10  
Scope: `mobile/` client, Expo configuration, API transport, server security configuration, and the local API smoke path.  
Reference: [OWASP MASVS](https://github.com/OWASP/masvs), especially `OWASP_MASVS.yaml`, plus the [OWASP MASTG](https://mas.owasp.org/MASTG/) testing guidance.

This is an engineering readiness review, not a penetration test, device-binary assessment, or OWASP certification. Native release artifacts, runtime instrumentation, dependency advisories, and production infrastructure still need an independent security review before launch.

## Control review

| MASVS area | Status | Evidence / action |
|---|---|---|
| MASVS-STORAGE-1 | Partial | Native access and refresh tokens and native profile/trip drafts use `expo-secure-store`; web drafts use browser storage. Temporary selfie/photo URI state is no longer included in the persisted Zustand slice. Production web storage policy and device backup behavior still need review. |
| MASVS-STORAGE-2 | Partial | Server production logging redacts authorization/cookie headers and the app does not log message or profile payloads. Screenshot/backup behavior still needs native-device verification. |
| MASVS-CRYPTO-1/2 | Pass for current scope | The client delegates transport encryption to platform `fetch`/TLS and token protection to SecureStore. The server uses cryptographically secure random OTP/session values and stores hashes of refresh tokens. No custom application cryptography is introduced. |
| MASVS-AUTH-1 | Pass | OTP/Apple identity verification is server-enforced; access tokens are short-lived JWTs tied to persisted server sessions; refresh tokens rotate and are hashed. |
| MASVS-AUTH-2 | N/A | No local PIN/biometric login is implemented. |
| MASVS-AUTH-3 | Partial | Account deletion and data export require recent session-bound authentication; sessions older than ten minutes require phone OTP or Apple re-authentication, valid for ten minutes. Apple-linked deletion revokes the stored Apple refresh token when production Apple credentials are configured. Other future sensitive operations should reuse the same gate. |
| MASVS-NETWORK-1 | Partial | Development LAN HTTP is intentionally supported for Expo Go. Production server validation requires HTTPS; release mobile configuration must point to an HTTPS API and remove local cleartext exceptions. |
| MASVS-NETWORK-2 | Not implemented | Certificate/public-key pinning is not configured. Evaluate pinning with an operational rotation plan before a high-risk production release. |
| MASVS-PLATFORM-1 | Partial | Contacts, location, photo library, camera, sharing, and the `raahi://` scheme are user-triggered. Deep-link parameter validation and native IPC behavior still need device-level MASTG tests. |
| MASVS-PLATFORM-2 | Pass for current scope | The app does not embed a WebView or expose a JavaScript bridge. |
| MASVS-PLATFORM-3 | Partial | Development OTP is shown only in non-production development mode. Chats, phone numbers, and profile data are displayed in native UI; screenshot/recording protection and notification redaction need native verification. |
| MASVS-CODE-1/2 | Partial | Expo targets current React Native/Expo packages, but minimum OS policy and enforced update behavior are not yet declared. Add an update policy before public distribution. |
| MASVS-CODE-3 | Action required | `npm audit --omit=dev` reports 25 transitive vulnerabilities, mostly through the current Expo/Metro toolchain. `npm audit fix --force` proposes a breaking Expo downgrade and was not applied. Review with an Expo-compatible upgrade path. |
| MASVS-CODE-4 | Pass for current scope | Zod contracts validate profile, trip, OTP, report, message, and upload-related inputs; server authorization is enforced per endpoint and upload signatures/size are checked server-side. |
| MASVS-RESILIENCE-1..4 | Not implemented / threat-model dependent | No jailbreak/root detection, attestation, anti-tamper, anti-debugging, or obfuscation is configured. These are release-hardening decisions, not substitutes for server authorization. |
| MASVS-PRIVACY-1 | Pass for current scope | Permissions are requested only from explicit actions. Exact location remains private, contacts are not uploaded, verification media is private, Apple refresh tokens are encrypted at rest, and no analytics SDK is bundled. |
| MASVS-PRIVACY-2/3/4 | Partial / Pass | The privacy screen explains collection and user rights; export, correction, permission changes, blocking, and deletion exist. Full unlinkability/data-declaration review and legal approval remain outstanding. |

## Fixed in this release pass

- Removed temporary selfie and pending-photo URIs from persisted client state.
- Kept session credentials in native SecureStore rather than AsyncStorage.
- Added session-epoch guards so in-flight refreshes, loads, messages, and feed responses cannot restore a previous account after logout or session expiry.
- Made the native/browser transport preserve the fetch receiver and added a regression test for logout during refresh.
- Added a MASVS evidence record to the project so future loops can track remediation instead of re-discovering the same gaps.
- Added loop-level human gates for auth, secrets, infrastructure, dependency upgrades, and security configuration.
- Moved native persisted profile/trip drafts to SecureStore with one-time migration from the legacy AsyncStorage key; native persistence no longer falls back to plaintext when SecureStore is unavailable.
- Added canonical inbound-interest context, recipient-trip identity, server-generated recommendation reasons, transactional accept/dismiss behavior, and database integration coverage.
- Added session-bound phone OTP re-authentication for data export and account deletion, including UI retry/cancel states and HTTP coverage.
- Added Apple authorization-code exchange, encrypted refresh-token storage, and token revocation before Apple-linked account deletion.
- Added a conservative server-side public-text safety boundary for profiles, trips, chat, Journal captions, and comments, plus message rate limiting; reports remain the human-review path.
- Added a generated opaque 1024px app icon, iOS privacy-manifest reasons, production URL/ATS validation, and the App Store release plan.
- Updated the development API smoke script to exercise re-authentication before export.

## Release blockers before production

1. Replace development OTP with Twilio Verify and remove all development OTP display paths from release builds.
2. Use an HTTPS API URL, remove local cleartext exceptions, and confirm ATS/Android network security settings in native builds.
3. Define production web-draft storage, native backup exclusion, and retention policy; native drafts are already stored in SecureStore.
4. Resolve or formally accept the audited Expo/Metro dependency advisories after a compatible framework upgrade.
5. Configure Apple authorization-code exchange/revocation secrets and test Apple-linked deletion against Apple’s provider.
6. Extend the session-bound step-up gate to future sensitive operations and verify recovery/support handling in production.
7. Run MASTG device tests for storage, backups, screenshots, notifications, deep links, permissions, TLS, and release debug flags.
