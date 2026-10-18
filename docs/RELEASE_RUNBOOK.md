# Raahi release runbook

## Environments

Maintain separate PostgreSQL databases, object-storage buckets, JWT secrets, admin tokens, and Twilio/Apple credentials for development, staging, and production. Never point a production build at a developer `.env` file.

Required production values:

```text
NODE_ENV=production
AUTH_MODE=twilio
DATABASE_URL=<managed-postgresql-with-pooling>
JWT_SECRET=<random-32-plus-character-secret>
PUBLIC_URL=https://api.raahi.app
CLIENT_ORIGIN=https://app.raahi.app
TWILIO_ACCOUNT_SID=<secret>
TWILIO_AUTH_TOKEN=<secret>
TWILIO_VERIFY_SERVICE_SID=<secret>
APPLE_CLIENT_ID=com.raahi.travel
APPLE_TEAM_ID=<apple-team-id>
APPLE_KEY_ID=<apple-sign-in-key-id>
APPLE_PRIVATE_KEY=<apple-sign-in-private-key>
APPLE_TOKEN_ENCRYPTION_KEY=<random-32-plus-character-secret>
ADMIN_TOKEN=<secret>
SUPPORT_EMAIL=support@raahi.app
```

## Deploy

1. Back up the production database and verify the backup timestamp.
2. Build the immutable server artifact with `npm ci`, `npm --workspace @raahi/server run db:generate`, and `npm run build`.
3. Run `npm --workspace @raahi/server run db:migrate` against staging first.
4. Run the smoke test against staging with `RAAHI_API_URL` and development OTP only in a non-production environment.
5. Deploy the server artifact.
6. Run `GET /v1/health` and confirm `status: ok` and `database: ok`.
7. Verify OTP, profile upload, discovery, mutual match, chat, report, export, and deletion with a staging account.
8. Deploy the EAS build only after the staging API is healthy.

## Local release verification

Use Windows PowerShell for the existing Windows `node_modules` installation. Run from the repository root. Mixing WSL Node with these dependencies fails to load Sharp, esbuild, and Rolldown. A Linux checkout/container must install its own dependencies.

After `npm run lint`, `npm run typecheck`, and `npm run build`, run the tests with an existing disposable test database:

```powershell
$env:DATABASE_URL="postgresql://raahi:raahi@localhost:5432/raahi_test?schema=public"
$env:RUN_DB_TESTS="1"
npm --workspace @raahi/server run db:migrate
npm test
npm --workspace @raahi/server run test:e2e
Remove-Item Env:DATABASE_URL
Remove-Item Env:RUN_DB_TESTS
```

Check each command's exit code before proceeding. HTTP E2E requires a database name containing `_test`; `RUN_DB_TESTS=1` enables the otherwise-skipped database integration test. These test settings must not carry over to the normal API startup shell.

Build and exercise the release images using Docker Desktop or a Linux Docker daemon:

```text
docker build --target runtime -t raahi-api:prelaunch .
docker build --target migrate -t raahi-migrate:prelaunch .
node scripts/check-release.mjs
```

The script creates uniquely named disposable containers, a fresh PostgreSQL database, a network, and media volumes, then removes them in `finally`. It checks migrations, the image healthcheck, production headers/auth/CORS, non-root/read-only execution, media writes, and private-media isolation. It also starts the same restricted runtime in development-auth mode for the health/OTP/photo/export/deletion smoke flow. Production credentials are inert fixtures; this check does not contact Twilio or validate external TLS. Override image tags with `RAAHI_RUNTIME_IMAGE` and `RAAHI_MIGRATE_IMAGE` when testing another build. Rebuild images after server changes so the check covers the current source.

For the web artifact, deploy `mobile/dist-web` with SPA fallback rewrites for `/index.html`; `mobile/public/_redirects` and `mobile/vercel.json` provide the Netlify and Vercel rules. This is required for reload/deep-link routes such as `/profile?id=...` and `/chat?id=...`.

For the native artifact, run `npm --workspace @raahi/mobile run export:ios` and `npm --workspace @raahi/mobile exec -- expo-doctor`, then complete the physical-device tests in `PRE_LAUNCH_AUDIT.md`.

## Account export scope

`GET /v1/account/export` is authenticated, derives its subject exclusively from the session, and returns `Cache-Control: no-store`. It requires recent session-bound authentication; sessions older than ten minutes must complete phone OTP or Apple re-authentication, which is then valid for ten minutes. Account deletion uses the same gate. Apple-linked account deletion revokes the stored Apple refresh token before removing the account record. Records are read in one repeatable-read transaction. It includes:

- The account's profile, saved precise location (if present), photo/prompt metadata, verification status/timestamps, and session identifiers/timestamps.
- The account's trips, Journal posts/media references, authored comments on any post, and own likes.
- Outgoing interests, passes, blocks, and submitted reports.
- Metadata for matches involving the account, with only its own sent messages and read state.
- Its registered devices' notification-enabled flags.

It excludes incoming private actions, content authored by other people, session hashes/access or refresh tokens, push tokens, and private selfie storage keys. It is a JSON data export, not a media archive; image bytes are not embedded. Cross-account E2E fixtures verify subject isolation, credential exclusions, and that a supplied `userId` query cannot switch the export subject.

## App Store release

Use [`docs/APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md) for the production EAS profile, public URL requirements, Apple credential requirements, Apple server-to-server notification URL, privacy-label preparation, screenshot sizes, review notes, and the final submission gate. The repository cannot create Apple signing credentials, publish production DNS/hosting, or submit App Store metadata without the owner's external accounts.

## Rollback

- Roll back the application artifact first if the schema remains backward-compatible.
- Do not roll back a migration by deleting tables. Restore from a verified backup or ship a forward migration.
- Keep the previous server image and previous mobile API URL available until the smoke run completes.
- Record the release, migration, rollback reason, operator, and UTC time.

## Backup and restore drill

Example managed PostgreSQL commands:

```bash
pg_dump --format=custom "$DATABASE_URL" > raahi-$(date -u +%Y%m%dT%H%M%SZ).dump
createdb raahi_restore_check
pg_restore --exit-on-error --dbname="$RESTORE_DATABASE_URL" raahi-YYYYMMDDTHHMMSSZ.dump
```

Run a restore test at least monthly and after a schema change. Store backups separately from the primary database and restrict access to the production operators.

## Key rotation

- Rotate JWT, Twilio, Apple, storage, and admin credentials in the secret manager.
- Restart API workers after rotation.
- Revoke the old credential only after health, OTP, admin review, and upload checks pass.
- Never paste a production key into issues, chat, source files, logs, or mobile bundles.

## Monitoring

Monitor `/v1/health`, HTTP 5xx rate, OTP failures, upload failures, database connections, storage errors, notification failures, and report queue age. Add Sentry or an equivalent error tracker before public launch; do not log phone numbers, tokens, selfies, precise coordinates, or message bodies.
