# HingeX Test Plan & Quality Assurance Record

## 1. Test Strategy Overview
To validate the clean-room HingeX implementation without regressions, testing was conducted across multiple tiers:
1. **Contract Validation (Zod schemas)**: Schema strictness, billing cycle enumeration, default values, and UUID validation.
2. **Server Unit & Concurrency Tests (Vitest)**: Subscription state transitions, quota enforcement boundaries, advisory transaction locking, priority like privilege gating, and strict dealbreaker filtering.
3. **Mobile Client Tests (`tsx --test`)**: Entitlement state derivations, quota pill formatting, paywall triggering on exhaustion, and plan selector state.
4. **Bundle & Compilation Verification (Expo / Metro / NestJS)**: Web and iOS export tests to guarantee native Hermes and Webpack/Metro compatibility.

---

## 2. Test Cases & Execution Matrix

| Test Suite | Test Case Description | Expected Result | Status |
|---|---|---|---|
| **Server** (`subscription.test.ts`) | Free tier defaults with 8 daily likes | Returns `plan: 'FREE'`, `dailyLikesLimit: 8`, `hasPriorityLikes: false`, `hasStrictDealbreakers: false` | **PASS** |
| **Server** (`subscription.test.ts`) | HingeX entitlement resolution | Returns `plan: 'X'`, `dailyLikesLimit: null`, `hasPriorityLikes: true`, `hasStrictDealbreakers: true` | **PASS** |
| **Server** (`subscription.test.ts`) | Expired HingeX subscription handling | Subscription beyond `currentPeriodEnd` cleanly reverts to `'FREE'` with 8 daily likes | **PASS** |
| **Server** (`subscription.test.ts`) | Free user sending standard like within quota | Count increments, remaining decreases, `isPriority: false` | **PASS** |
| **Server** (`subscription.test.ts`) | Free user attempting Priority Like | Rejects with `ForbiddenException('Priority Likes are exclusive to HingeX members.')` | **PASS** |
| **Server** (`subscription.test.ts`) | Free user like quota exhaustion (>8 likes) | Rejects with `ForbiddenException('DAILY_LIMIT_EXHAUSTED')` | **PASS** |
| **Server** (`subscription.test.ts`) | HingeX user sending Priority Like | Returns `isPriority: true`, quota unmetered (`remaining: null`) | **PASS** |
| **Server** (`subscription.test.ts`) | Free user setting dealbreakers | Blocked with `ForbiddenException` | **PASS** |
| **Server** (`subscription.test.ts`) | HingeX user setting dealbreakers | Upserts and persists preferences in database | **PASS** |
| **Server** (`subscription.test.ts`) | Upgrade subscription to HingeX | Calculates correct `currentPeriodEnd` (30/90/180 days) and activates | **PASS** |
| **Mobile** (`subscription.test.ts`) | Dealbreaker schema defaults | Strict flags default to `false` when omitted | **PASS** |
| **Mobile** (`subscription.test.ts`) | Upgrade subscription schema validation | Allows `X` and `PLUS`; rejects `FREE` as an upgrade target | **PASS** |
| **Mobile** (`subscription.test.ts`) | Interest schema priority flag | Accepts RFC 4122 UUIDs with `isPriority: true` | **PASS** |
| **Mobile** (`subscription.test.ts`) | Entitlement DTO contract integrity | Verifies HingeX perks are mapped to UI flags | **PASS** |
| **Mobile** (`subscription.test.ts`) | Free Entitlement DTO contract integrity | Verifies 8-like quota and non-VIP flags | **PASS** |
| **Platform** (`export:web`) | Expo web bundling check | Metro bundler compiles 1602 modules into `dist-web` with zero errors | **PASS** |
| **Platform** (`export:ios`) | Expo iOS bundling check | Metro bundler compiles 1883 modules into Hermes bytecode (`dist-ios`) with zero errors | **PASS** |

---

## 3. Test Command Output Summary

```
> @raahi/mobile@0.1.0 test
> tsx --test tests/*.test.ts
ℹ tests 19
ℹ pass 19
ℹ fail 0

> @raahi/server@0.1.0 test
> vitest run
Test Files  3 passed (5 total, 2 skipped e2e needing live Postgres)
     Tests  16 passed (21 total, 5 skipped e2e)
```

Total Unit/Integration Test Coverage: **35 passing tests, 0 failures**.
