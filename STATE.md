# Loop State — My Project

Last run: 2026-10-10T21:35:00Z

## High Priority (loop is acting or waiting on human)

- MASVS remediation: native profile/trip drafts now use SecureStore; define the production web-storage and backup policy before launch.
- MASVS network: production mobile builds must use HTTPS; evaluate certificate pinning and native ATS/Android network security configuration.
- Dependency review: `npm audit --omit=dev` reports 25 transitive Expo/Metro advisories; do not apply the breaking `npm audit fix --force` suggestion.
- Native verification: run MASTG device tests for screenshots, backups, notifications, deep links, permissions, release debug flags, and update enforcement.
- App Store submission: Apple Developer enrollment/signing, public HTTPS API/legal/support URLs, production provider credentials, App Store metadata, screenshots, and TestFlight review remain external gates.
- Web deployment: use the SPA fallback rules shipped in `mobile/public/_redirects` or `mobile/vercel.json` for reload-safe ID-bearing routes.

## Watch List

- Extend the session-bound step-up gate to future sensitive operations and verify recovery/support handling in production.
- Verify Apple authorization-code exchange and refresh-token revocation with real Apple credentials; do not claim this from local mocks.
- Decide minimum OS support and enforced-update behavior.
- Evaluate attestation, jailbreak/root detection, obfuscation, and runtime integrity against the production threat model.
- Preserve report-only loop operation until at least one human-reviewed cycle is recorded.

## Recent Noise (ignored this run)

---
Run log: `loop-run-log.md` · outcome: escalated; full-stack interaction, re-authentication, Apple-token handling, production configuration, and EAS simulator packaging are implemented/verified; signed-device and hosting gates remain external
