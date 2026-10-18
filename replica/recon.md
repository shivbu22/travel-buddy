# Recon map: HingeX (iOS & Android)

Scope: HingeX Premium Tier — Priority Likes, Enhanced Recommendations, Unlimited Likes, See All Who Liked You Grid, Strict Dealbreakers, VIP Badge, and Subscription Paywall/Management
For: Raahi / Travel Buddy (Travel Companion Matching Platform)
Date: 2026-10-16

## Sources

| # | source | URL / Reference | notes |
| --- | --- | --- | --- |
| 1 | Hinge APKM Audit | docs/HINGE_APKM_AUDIT.md | Verified compiled APK resources, subscriptions, offers, priority likes, standouts, and Jetpack Compose paywalls |
| 2 | Hinge Help Center | https://hingeapp.zendesk.com/hc/en-us/articles/115004724907-What-is-HingeX | Official feature definitions: Priority Likes, Enhanced Recommendations, Unlimited Likes |
| 3 | App Store / Google Play Listing | Hinge Dating App: Meet People | Paywall layout, screenshot carousel, HingeX value proposition and tier comparisons |
| 4 | Raahi Full Stack Rules | docs/RAAHI_FULL_STACK_RULES.md | Section on monetization: server-authoritative entitlements, transparent states, travel companion adaptation |

## Core loop

Travelers subscribe to HingeX to accelerate travel connections through Priority Likes (staying at the top of incoming likes queues), Enhanced Recommendations (real-time adaptive feed ranking), unlimited daily likes, and browsing all incoming interests simultaneously in a grid view.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | HingeX Paywall & Tier Comparison | /paywall or triggered by daily like limit / feature lock | Present HingeX vs Hinge+ vs Free, duration options, purchase action | Benefits carousel, comparison matrix, tier selector (1, 3, 6 mo), purchase button, restore link, terms | default, loading, processing, success, error, restored |
| S02 | Discover Feed with HingeX Badges & Quota | /home?tab=discover | Discover travelers with HingeX real-time adaptive ranking & priority like toggle | Card stack, priority like toggle, daily like counter pill, HingeX badge | active, daily limit reached, empty, error |
| S03 | Enhanced Discovery Filters & Dealbreakers | /home?tab=discover (options modal) | Set strict dealbreakers on style, pace, verified status | Dealbreaker switches, style chips, pace picker, reset button | default, modified, dealbreaker-active |
| S04 | Likes You Grid View (Full Feed) | /home?tab=matches (Likes tab) | Browse all incoming likes simultaneously with filter support | Grid gallery of incoming cards, priority like banners, quick match/pass | single (free), full grid (HingeX), empty |
| S05 | Priority Like Sending Modal / Action | /home?tab=discover or /profile | Send a priority interest with optional opening note | Priority badge toggle, comment input, send button | normal, priority enabled, sending, sent |
| S06 | Manage Subscription & Membership Settings | /settings -> /subscription or modal | View active plan, renewal date, cancel auto-renew, restore purchases | Tier badge, plan status, renewal date, cancel button, restore button | active, canceled, expired |

## Flows

```
F01 Free User Hits Daily Like Quota -> Upgrades to HingeX
    S02 Discover -> Likes person -> 8th like reached -> S01 Paywall opens -> Select 3-month HingeX -> Tap Subscribe -> Entitlement active -> S02 resumes with Unlimited Likes
    happy path clicks: 4
    edge: payment failure, network drop during purchase, user dismisses paywall (feed locked until tomorrow)

F02 HingeX Member Sends Priority Like
    S02 Discover -> Tap Priority Like button -> Optional comment added -> Sent -> Server flags interest as isPriority: true -> Moves to top of recipient's S04 queue
    happy path clicks: 2
    edge: recipient blocks user, trip window changes

F03 Recipient Reviews Likes You Grid with Priority Likes
    S04 Likes You -> Sees Priority Like pinned at the top with Gold VIP banner -> Taps to view full profile & note -> Accepts interest -> Instant mutual match celebration
    happy path clicks: 2
    edge: multiple priority likes ordered by timestamp

F04 Setting Strict Dealbreakers
    S02 Discover -> S03 Filters -> Toggle "Strict Dealbreaker: Verified Travelers Only" -> Apply -> Feed recalculates strictly filtering out unverified travelers
    happy path clicks: 3
    edge: zero results with strict dealbreakers -> Empty state with suggestion to loosen
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| HingeXBadge | gold, charcoal, pill | default, compact | S01, S02, S04, S06 |
| TierComparisonTable | 3-column (Free / Plus / X) | default | S01 |
| PlanDurationCard | 1 Month, 3 Months, 6 Months | default, selected, best-value | S01 |
| PriorityLikeButton | standalone, inline | default, pressed, active, busy | S02, S05 |
| PriorityBanner | gold ribbon | default | S04 |
| DealbreakerToggle | switch with lock | enabled, locked (free), active | S03 |
| LikeQuotaPill | normal, warning, unlimited | default | S02 |

## Inferred data model

```
Subscription
    id: UUID, userId: UUID (unique), plan: 'FREE' | 'PLUS' | 'X'
    status: 'ACTIVE' | 'CANCELED' | 'EXPIRED'
    billingCycle: 'MONTHLY' | 'TRIMONTHLY' | 'SEMIANNUAL'
    startedAt: DateTime, currentPeriodEnd: DateTime, autoRenew: Boolean
    evidence: docs/HINGE_APKM_AUDIT.md compiled subscriptions & offers
    confidence: high

DailyLike
    id: UUID, userId: UUID, date: Date (YYYY-MM-DD), count: Int
    evidence: Hinge daily like limit (free users 8/day, HingeX unlimited)
    confidence: high

Interest (extension)
    isPriority: Boolean (default false)
    evidence: Priority Likes placed at top of recipient's queue
    confidence: high

DealbreakerPreference
    userId: UUID, strictVerifiedOnly: Boolean, strictSamePace: Boolean, strictBudgetOverlap: Boolean
    evidence: HingeX advanced preferences and dealbreakers
    confidence: high
```

Relationships:
- User 1-1 Subscription
- User 1-n DailyLike
- User 1-1 DealbreakerPreference
- Interest has isPriority flag

## Feature matrix

See `replica/features.csv`. Must: 8, should: 4, could: 2, skip: 1.

## Out of scope (cannot or should not be cloned)

- Third-party dating app brand assets, trademarks, or copyrighted artwork (Raahi retains its distinct travel-companion identity and luxury gold/charcoal design tokens).
- Proprietary closed-source neural network weights (Raahi uses transparent, deterministic compatibility scoring + real-time adaptive ranking).

## Size

Screens: 6, flows: 4, entities: 4. Hard parts: idempotent subscription state machine, priority like queue ordering, daily quota race-condition prevention, responsive mobile & web paywall. Size: M.
