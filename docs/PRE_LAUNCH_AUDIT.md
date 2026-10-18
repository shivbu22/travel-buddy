# Pre-launch checklist audit

Source: `Pre-Launch Checklist for a Vibe-Coded App.docx`, Apptension Developer Handbook, DVIA-v2 security categories, and Appllama mobile build standards.

Legend: **DONE** = implemented and validated; **PARTIAL** = code/documentation exists but needs credentials, infrastructure, or human testing; **BLOCKED** = cannot be completed from this Windows workspace without an external account/device.

## Latest local verification — 2026-10-10

| Check | Result |
| --- | --- |
| Lint, workspace typecheck, server/contracts build | Passed after the final export changes |
| Mobile tests | 14/14 passed, including production-config and account-switching regressions |
| Server tests, with `RUN_DB_TESTS=1` and disposable `raahi_test` database | 11/11 passed; no skips |
| HTTP E2E | 6/6 passed, including session-isolated reauthentication and export privacy regression |
| iOS JavaScript export | Passed; EAS iOS simulator build `59f6b290-e287-4954-ac32-5d5b056d1218` finished successfully |
| Expo Doctor | 21/21 passed |
| Docker runtime and migration images | Both built successfully after the Apple revocation migration |
| `node scripts/check-release.mjs` | Passed fresh-database migrations, production startup/healthcheck, headers, auth, CORS, read-only/non-root execution, writable media volumes, private-media isolation, and development-auth smoke |
| Final LAN API restart and smoke | Healthy at `http://192.168.1.7:4000/v1`; OTP/photo/export/deletion smoke passed after the Apple migration |

The container check uses disposable database/media resources and inert provider credentials. It does not validate live SMS, Apple Sign In, TLS termination, production hosting, or a native iPhone build. Run commands from Windows PowerShell in this workspace: its installed native dependencies target Windows, so WSL cannot run the same test binaries. Linux dependencies are independently installed inside the Docker build.

## 1. Code review and understanding

- **DONE** TypeScript contracts, Nest controllers/services, Prisma schema/migrations, Expo routes, state, permissions, and API transport reviewed.
- **DONE** `.env`, uploads, verification-private, Expo, and generated build artifacts are ignored.
- **DONE** TypeScript typecheck and production server build run in the validation loop.
- **DONE** ESLint is configured and runs with zero warnings/errors.
- **PARTIAL** `npm audit --omit=dev` reports 25 transitive moderate/high issues, primarily the Expo/React Native/Metro toolchain; Fastify/static advisories are patched to `fastify@5.12.5` and `@fastify/static@10.1.5`. Do not force an Expo major upgrade without a dedicated SDK migration.

## 2. Functionality testing

- **DONE** OTP, refresh/logout, profile photo upload, profile saving, trip creation, discovery, interest, mutual match, chat, block, report, unmatch, verification, Journal, export, and deletion paths are implemented.
- **DONE** Inbound interest review preserves sender trip, recipient trip, target context, recommendation reasons, durable dismissals, and server-authoritative accept/match behavior.
- **DONE** Data export and account deletion require recent session-bound authentication; older sessions require phone OTP or Apple re-authentication. Browser Settings flow and HTTP E2E coverage verify request, retry/cancel, verification, and sensitive-action enforcement. Apple-linked deletion now revokes the stored Apple token before removing the account.
- **DONE** Domain and database integration tests cover matching/chat/blocking.
- **DONE** API smoke script covers health, OTP, photo upload, export, and deletion in development mode; disposable HTTP E2E tests cover security headers, CORS, replay, refresh rotation, corrupt media, privacy cleanup, pagination, blocking, and rate limiting.
- **PARTIAL** Physical iPhone camera, Contacts, precise location, push, Apple Sign In, Apple token revocation, and low-bandwidth testing require production credentials and the device.
- **PARTIAL** Full motion/simulator recording requires macOS/Xcode or a configured iOS device.

## 3. Security

- **DONE** Hashed rotating refresh sessions, expiring/attempt-limited OTP, server-side Zod validation, Prisma parameterized queries, ownership checks, block checks, upload signature/size limits, route rate limits, protected admin routes, security headers, restricted CORS, and private selfie storage.
- **DONE** No cookies are used by the mobile API, so CSRF is not the session model; bearer authorization is required for state changes.
- **DONE** HSTS is emitted in production; production refuses development auth and non-HTTPS `PUBLIC_URL`.
- **PARTIAL** Public media is intentionally served from `/uploads`; use managed object storage/CDN with private verification storage in production.
- **PARTIAL** Dependency advisories remain in the Expo/React Native toolchain and require a coordinated SDK upgrade.

## 4. Database and data

- **DONE** Foreign keys, cascading relationships, indexes, unique constraints, versioned migrations, and explicit deletion cleanup exist.
- **DONE** Account export returns a consistent database snapshot of the requester's profile/location, session metadata, trips, posts/media references, authored comments, likes, outgoing interests/passes/blocks/reports, participating-match metadata, own sent messages/read state, and device notification preferences. Incoming private actions, other authors' content, session hashes/tokens, push tokens, and private selfie paths are excluded. Media binaries are not embedded. Deletion includes media cleanup.
- **PARTIAL** Managed backups, pooling, encryption-at-rest configuration, retention jobs, and restore drills need production infrastructure.
- **DONE** Seed code refuses to run when `NODE_ENV=production`.

## 5. Performance

- **DONE** Profile images are resized on-device; image uploads and Journal media are bounded; core list queries are indexed and capped.
- **DONE** Journal supports a stable cursor; messages already support pagination.
- **PARTIAL** FlashList migration, release-build profiling, load testing, CDN delivery, and Core Web Vitals require a release environment.

## 6. Errors and monitoring

- **DONE** Health endpoint includes database readiness, API timeout messaging, upload timeout messaging, inline form errors, empty states, and socket fallback polling.
- **PARTIAL** Sentry/error tracking, uptime alerts, analytics, status page, and structured production log shipping need external services.

## 7. Infrastructure and deployment

- **PARTIAL** CI workflow is configured for migrations, lint, typecheck, tests, and build against PostgreSQL; a hosted GitHub Actions run is still unverified because this workspace has no Git repository/remote configured.
- **DONE** Runtime and migration Docker images build and pass the disposable release-container check under the restrictions used by `compose.release.yml`.
- **DONE** Deployment, rollback, key rotation, backup, and restore runbook exists.
- **PARTIAL** Domain, TLS, staging, managed Postgres, object storage, autoscaling, spending alerts, Apple Developer credentials, EAS signing credentials, and App Store Connect metadata need owner accounts.

## 8–10. UI, accessibility, SEO and sharing

- **DONE** Native safe areas, labeled controls, reduced-motion support, dark mode tokens, empty/loading/error states, 44pt-style action targets, alt labels, and system share are implemented.
- **DONE** Web SPA fallback deployment rules are included for Netlify and Vercel so ID-bearing profile/chat routes survive reloads.
- **PARTIAL** Native release validation still requires iOS Dynamic Type XL, screen-reader, keyboard/accessibility, and relevant Android device checks. Web SEO metadata, sitemap, canonical URLs, and Open Graph assets should be added if the web surface becomes public.

## 11. Legal and compliance

- **DONE** In-app terms/privacy copy describes consent, optional permissions, deletion, export, verification privacy, and India grievance contact placeholder.
- **PARTIAL** DPDP Act 2023 legal review, published privacy policy, retention schedule, grievance operator, and vendor DPAs require legal/business ownership.

## 12. Payments and business logic

- **N/A for current MVP** No payments, subscriptions, or stored card data exist.

## 13. Email, SMS and notifications

- **DONE** Push permission is opt-in and device tokens are validated and removable. Public profile/trip/chat/Journal text has a conservative server safety filter and user reports remain reviewable in the admin queue.
- **PARTIAL** Twilio production delivery, push credentials, limits, provider monitoring, and support inbox need external setup.

## 14. AI-specific risks

- **N/A for current MVP** No LLM or AI API is used in authentication, matching, moderation, or content publication.

## 15–16. Documentation and support

- **DONE** Root/server README, product audit, release runbook, CI, smoke script, and in-app support/export actions exist.
- **PARTIAL** Support inbox, public status page, changelog process, and human moderation staffing remain launch operations decisions.
