# Raahi API

NestJS API for Raahi. It includes phone OTP / Apple session authentication, profile and photo uploads, trips, server-filtered discovery, reciprocal interest and match creation, Socket.IO chat, reports, blocks, notification tokens, and account deletion. PostgreSQL is the source of truth; Redis is reserved for queue and rate-limit expansion.

```bash
npm run db:up                 # from the repository root
npm run db:setup              # generate, migrate, seed development travelers
npm --workspace @raahi/server run start:dev
```

API prefix: `/v1`. Health check: `GET /v1/health`; a healthy local response reports both `status: "ok"` and `database: "ok"`.

Development seed phones are `+919000000001`, `+919000000002`, and `+919000000003`; with `AUTH_MODE=development`, request OTP to receive the code in the JSON response. Never use that mode in production. Production configuration is documented in `.env.example`.

The discovery service enforces verified/onboarded users, reciprocal safety preferences, destination equality, at least three overlapping travel days, open trips, reciprocal block filtering, and mutual interests before chat authorization. `server/prisma/schema.prisma` is the persistence contract.

New profiles also require a submitted selfie review before profile save/discovery. Review with `GET /v1/admin/verifications` and approve/reject with `POST /v1/admin/verifications/:userId/review` using the `ADMIN_TOKEN` bearer token. Selfie files are stored under the private `VERIFICATION_DIR` and are never exposed as profile media.

Travel Journal endpoints are authenticated: `GET /v1/posts/feed?cursor=...` returns `{ items, nextCursor }`, multipart `POST /v1/posts` with one-to-six images plus `caption`, `city`, and `country`, `POST /v1/posts/:id/like` with `{ liked: boolean }`, `POST /v1/posts/:id/comments`, `POST /v1/posts/:id/report`, and owner-only `DELETE /v1/posts/:id`. Public stories require an onboarded, phone/Apple-verified, selfie-approved author.

```bash
npm test                         # unit/domain tests; DB flow is skipped
$env:RUN_DB_TESTS="1"; npm test # PowerShell: also exercise Postgres matching/chat/blocking
```
