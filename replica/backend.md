# Backend Implementation: HingeX (Raahi)

Implementation record for HingeX server-side entitlements, quota enforcement, and priority queues.

## Auth & Permissions

- Standard session-authenticated requests (`@UseGuards(AuthGuard)`)
- Subscriptions, deals, and daily quota mutations bound to `req.userId`
- Dealbreaker modifications strictly gated by `hasStrictDealbreakers` entitlement (HingeX only)

## Database Models & Migrations

- `Subscription`: 1-1 with User. Holds `plan` ('FREE', 'PLUS', 'X'), `status`, `billingCycle`, `currentPeriodEnd`, `autoRenew`.
- `DailyLike`: Tracks per-day like count for daily quota (8 likes/day for free users; bypassed for PLUS & X).
- `DealbreakerPreference`: User's strict travel preferences (`strictVerifiedOnly`, `strictSamePace`, `strictBudgetOverlap`).
- `Interest`: Added `isPriority` Boolean flag and compound index `[toUserId, isPriority, createdAt]`.
- Prisma migration: `server/prisma/migrations/20261016180000_hingex_subscriptions/migration.sql`.

## Security & Invariants Checklist

- [x] Input validated with Zod contracts (`upgradeSubscriptionSchema`, `dealbreakerSchema`, `interestSchema`)
- [x] Server-authoritative entitlement checks: Free users cannot self-grant Priority Likes or bypass daily limits
- [x] Atomic transactions with PostgreSQL advisory locks:
  - `pg_advisory_xact_lock` on `interest-quota:${userId}` prevents concurrent quota bypass
  - `pg_advisory_xact_lock` on `hashtext(pairKey)` prevents race conditions on likes
- [x] Idempotent subscription upgrade: upserts subscription record and calculates expiration timestamp
- [x] Clean cancellation: `autoRenew` set to false, preserving access until `currentPeriodEnd`
- [x] Priority Likes sorting: `orderBy: [{ isPriority: 'desc' }, { createdAt: 'desc' }]` guarantees HingeX priority likes appear first in recipient's feed

## Endpoints

- `GET /subscription/plans` -> Returns tier catalog (Plus and X) with pricing, discount tiers, and features
- `GET /subscription/me` -> Returns current user's plan, entitlement flags, and daily likes remaining
- `POST /subscription/upgrade` -> Subscribes to Hinge Plus or HingeX (1, 3, or 6 months)
- `POST /subscription/restore` -> Validates and restores active subscription
- `POST /subscription/cancel` -> Turns off auto-renewal
- `GET /subscription/dealbreakers` -> Fetches user's strict dealbreaker preferences
- `PUT /subscription/dealbreakers` -> Updates dealbreakers (HingeX exclusive)
