# Architecture: Raahi HingeX (A Rebuild of HingeX Core Capabilities)

## Stack

| layer | choice | why |
| --- | --- | --- |
| mobile app | Expo (React Native) + TypeScript | Cross-platform iOS/Android native feel with shared web export |
| server | NestJS + TypeScript | Clean dependency injection, modular controllers/services, server-authoritative invariants |
| database | PostgreSQL via Prisma ORM | Relational integrity, ACID transactions for billing/entitlements, indexing |
| contracts | @raahi/contracts (Zod) | End-to-end typed contract synchronization between server and client |
| store / state | Zustand + SecureStore | Transient UI state, optimistic feedback with server reconciliation |
| styling | Design Tokens (tokens.json, tokens.css, palette system) | Strict WCAG AA compliance, Apple glassmorphism, luxury HingeX gold/charcoal theme |

## Schema

See `replica/schema.sql` and `server/prisma/schema.prisma`.

4 new / updated entities:
1. `Subscription`: Tracks user plan (`FREE`, `PLUS`, `X`), status (`ACTIVE`, `CANCELED`, `EXPIRED`), billingCycle (`MONTHLY`, `TRIMONTHLY`, `SEMIANNUAL`), startedAt, currentPeriodEnd, autoRenew.
2. `DailyLike`: Tracks per-day like usage per user (`userId`, `date`, `count`) to enforce free tier limit (8 likes/day) while granting unlimited likes to HingeX/Plus.
3. `DealbreakerPreference`: Tracks user's strict filters (`strictVerifiedOnly`, `strictSamePace`, `strictBudgetOverlap`).
4. `Interest` (field addition): `isPriority` Boolean flag. When true, recipient's "Likes You" query orders priority likes before standard likes.

Access rules: Server-side NestJS auth guards and user session checks. Users can only query/mutate their own subscription, quota, and dealbreakers.

## API

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /subscription/me | Returns active subscription & full entitlement DTO | Authenticated user | None | EntitlementDto | F01, S01, S06 |
| GET /subscription/plans | Returns tier offerings, features, pricing, discount rates | Anyone / Authenticated | None | PlanOfferingsDto | S01 |
| POST /subscription/upgrade | Subscribes to Hinge+ or HingeX (1, 3, or 6 months) | Authenticated user | UpgradeSubscriptionInput | EntitlementDto | F01, S01 |
| POST /subscription/restore | Restores previous purchases or resets entitlement | Authenticated user | None | EntitlementDto | S01, S06 |
| POST /subscription/cancel | Cancels auto-renew at end of current period | Authenticated user | None | EntitlementDto | S06 |
| GET /subscription/dealbreakers | Retrieves current strict dealbreaker preferences | Authenticated user | None | DealbreakerDto | S03 |
| PUT /subscription/dealbreakers | Updates strict dealbreaker preferences (HingeX exclusive) | Authenticated user | DealbreakerInput | DealbreakerDto | F04, S03 |

## The parts that bite

- **Idempotency**: Subscriptions and upgrade mutations must be strictly idempotent. Upgrading when already on an active plan updates the plan or extends the term without duplicate charging.
- **Quota race conditions**: Daily like counter uses atomic increment or transactional find-and-update to prevent double-spending the 8th daily like.
- **Priority Like queue sorting**: In `getIncomingInterests`, query sorts by `isPriority DESC, createdAt DESC` so HingeX priority likes appear first without starvation.
- **Server authority**: Client never decides whether daily likes are unlimited or if a like is priority; the backend checks user's active entitlement before granting priority flag or allowing >8 likes.

## Build order

1. **Contracts & Schema**: Add Zod schemas and Prisma models for Subscription, DailyLike, DealbreakerPreference, and Interest.isPriority.
2. **Backend Services & Controllers**: Implement `SubscriptionService`, `SubscriptionController`, integrate daily limit and priority likes into `SocialService`.
3. **Design Tokens & Components**: Add HingeX gold/charcoal luxury tokens (`tokens.json`), contrast check, and component specs.
4. **Mobile Screens & Store**: Build `Paywall` screen, HingeX badge, priority like trigger, dealbreaker modal, and update `store.ts` & `api.ts`.
5. **Testing & Parity**: Run test suites, verify parity score reaches 100%, and generate parity report.
