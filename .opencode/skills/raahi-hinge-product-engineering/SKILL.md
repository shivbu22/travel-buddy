---
name: raahi-hinge-product-engineering
description: Use when building, auditing, or redesigning Raahi’s travel-dating product flows, especially onboarding, profile prompts/media, discovery, contextual likes, matches, chat, safety, verification, premium actions, or full-stack state synchronization. Apply the Hinge APK audit and Raahi full-stack rules without copying Hinge branding or proprietary assets.
---

# Raahi Hinge-Informed Product Engineering

Use this skill for Raahi feature work that crosses product UX, React Native/Expo, NestJS, Prisma, shared contracts, and security.

## Required reading

Before implementation, read:

- `docs/HINGE_APKM_AUDIT.md`
- `docs/RAAHI_FULL_STACK_RULES.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/MASVS_AUDIT.md`

## Workflow

1. Identify the user goal and the exact surface: onboarding, profile, discover, likes, match, chat, safety, verification, account, or premium.
2. Check the existing screen, route, contract, controller, service, Prisma model, store action, and API method before adding a parallel path.
3. Define the durable state transition and its idempotency key before writing UI.
4. Make the server response canonical. Never let optimistic UI invent a match, entitlement, verification result, or safety outcome.
5. Make navigation reload-safe. Any profile, chat, match, or report surface that needs an entity ID must put that ID in the URL/route.
6. Add loading, success, empty, retry, cancellation, and failure states.
7. Preserve unfinished onboarding drafts and provide an explicit finish-later/exit path.
8. Use contextual interaction targets: a user can like a profile, photo, prompt, trip, or story, and the recipient can understand the context.
9. Keep safety controls close to the relevant content and test block/report/unmatch independently.
10. Verify web and native behavior separately for permissions, camera, contacts, location, notifications, and sharing.

## Implementation rules

- Use shared Zod contracts for every API request and response.
- Put authorization and invariants in NestJS services, not screens.
- Use Prisma transactions for interactions that affect multiple rows.
- Use client mutation IDs for likes, passes, messages, comments, reports, and trip mutations.
- Use store account epochs to reject stale responses after logout or account switching.
- Persist only local drafts, theme, and non-sensitive cache state. Do not persist selfies or unnecessary PII.
- Use visible text buttons for primary actions; icon-only controls require accessibility labels.
- Avoid nested cards, generic gradient-heavy surfaces, dead-end modals, and irreversible hidden actions.

## Hinge-informed interaction patterns

- Profile cards should expose a clear reason to engage.
- Likes should support an optional opening line and target context.
- Discovery should have filters, a clear empty state, and an undo/reset recovery path.
- Matches should have a useful first-message prompt and visible safety controls.
- Profile editing should be modular: basics, media, prompts, preferences, verification, and account settings.
- Education should appear at first use and be dismissible.
- Premium actions must show entitlement, limit, purchase, restore, and failure states without pretending success.

## Verification checklist

Run:

```text
npm run typecheck
npm test
npm run lint
npm run build
npm run smoke:api
npm --workspace @raahi/mobile run export:web
npm --workspace @raahi/mobile run export:ios
```

For UI work, also run a fresh browser flow through OTP, incomplete-profile resume, finish-later, profile reload, chat reload, Journal, safety, and data export. For native-only behavior, record simulator/device evidence rather than marking web fallbacks as complete.
