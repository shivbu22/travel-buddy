# Raahi Full-Stack Product Rules

These rules convert the Hinge APK audit into implementation constraints for Raahi. Raahi remains a travel-connection product: destination, dates, pace, budget, trip intent, and safety are always more important than dating-app imitation.

## Account and onboarding

- OTP/Apple authentication creates or resumes an account; it never silently creates a second profile.
- `User.onboarded` is server authority. Local state may cache a draft but may not mark an account complete.
- Onboarding is resumable and user-controlled. Every step has back, cancel/finish-later, loading, retry, and draft-preservation behavior.
- Existing authenticated users go to Home when onboarded and to “Continue your profile” when incomplete. They never see blank fields if a draft exists.
- Exiting setup must not log the user out or destroy the draft.
- Save profile is idempotent and returns the canonical server profile.
- Photos and verification requirements are explicit before discovery is unlocked.

## Profile model

- Minimum public profile: three photos, name, age, home city, bio, travel styles, pace, language, intention, safety preference, and one prompt.
- Profile media is ordered and independently editable.
- Prompts, photos, trip passport, and verification state are independently addressable interaction targets.
- Private selfie media never enters public profile payloads or local persisted drafts.
- Profile completeness is computed on the server and rendered as a recovery checklist.

## Discovery and ranking

- Every feed item has a stable recommendation ID, source, trip ID, compatibility reasons, and interaction status.
- Feed queries are scoped by trip, destination, date overlap, budget, pace, style, gender preference, safety, block list, pass list, and verification state.
- Like/pass/super-interest mutations are idempotent by `(actor, target, trip, action, clientMutationId)`.
- Pass history is reversible only through an explicit undo/reset action.
- The client never invents compatibility or mutual-match state.
- Empty states explain the reason and provide a useful next action.

## Contextual interest

Raahi supports these interaction targets even when the current UI exposes only some of them:

- traveler profile
- profile photo
- prompt answer
- trip passport
- Journal story
- future voice/video prompt

Each interest may carry one short opening line. The server stores target type, target index/id, comment, source surface, and whether it produced a mutual match.

## Matches and messaging

- Chat access requires mutual interest.
- A match is immutable history; ending a match removes chat access but preserves moderation/audit records.
- Messages are idempotent by client message ID.
- Message send has sending/sent/failed/retry states.
- Chat supports report, block, unmatch, notification preferences, and starter prompts without hiding those controls.
- Web and native must share the same route IDs so reload/deep-link does not lose context.

## Safety and trust

- Report and block are separate actions.
- Blocking hides both users and ends matching/chat access.
- Reports are private, reasoned, rate-limited, reviewable, and never exposed to the reported user.
- Selfie verification has consent, capture, processing, approved/rejected/pending, retry, and retention states.
- Location and contacts are optional, foreground-only where possible, and never shown as precise discovery data.
- Screenshot/backup/native security controls are release checks, not promises made by web-only builds.

## Full-stack boundaries

- Controllers validate input through shared contracts.
- Services own invariants and authorization.
- Prisma models represent durable state; Zustand represents UI/cache/drafts only.
- All destructive or premium actions are server-authoritative.
- Every mutation returns the canonical DTO needed to update the client without optimistic lies.
- Realtime events are advisory; periodic fetch/reconciliation remains the source of truth.
- Auth/session epochs prevent stale responses from restoring a previous account.

## UX quality gates

- No dead-end setup screen.
- No button that can remain busy indefinitely.
- No route that requires an in-memory object after browser reload.
- No critical action without a labeled empty, error, retry, and success state.
- No icon-only control without an accessibility label.
- No generic “something went wrong” when the server can provide a recoverable cause.
- Test every user-facing flow on web and native where the capability exists.
