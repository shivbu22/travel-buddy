# HingeX Implementation Bug Log & Triage Record

The following defects and issues were identified during development, static analysis, and test suite execution. All issues were triaged, diagnosed to their root cause, and permanently resolved.

---

### Bug 01: Entitlement property name misalignment between client and contracts
- **Severity**: High (TypeScript compilation failure)
- **Symptom**: `mobile/src/screens/home.tsx` failed typecheck with `Property 'canSeeAllLikes' does not exist on type 'EntitlementDto'` and `Property 'canSendPriorityLikes' does not exist on type 'EntitlementDto'`.
- **Root Cause**: The client UI component used tentative property names from initial ideation instead of the canonical contract properties defined in `@raahi/contracts` (`hasFullLikesYouGrid` and `hasPriorityLikes`).
- **Fix**: Updated `home.tsx` to reference `hasFullLikesYouGrid` and `hasPriorityLikes`. Re-ran typecheck: passed with exit code 0.

---

### Bug 02: Priority Like attempted by Free/Plus user was not explicitly blocked
- **Severity**: Medium (Security / Privilege Escalation)
- **Symptom**: If an unprivileged client crafted an HTTP interest request with `isPriority: true`, the server would silently record it as `isPriority: false` rather than rejecting the unauthorized request.
- **Root Cause**: `SubscriptionService.recordLikeInTx` only branched on `plan === 'FREE'` for quota counting, without rejecting priority like requests from free or Plus users.
- **Fix**: Added an explicit security check in `recordLikeInTx`:
  ```ts
  if (plan === 'FREE' || plan === 'PLUS') {
    if (requestedPriority) {
      throw new ForbiddenException('Priority Likes are exclusive to HingeX members.');
    }
  }
  ```
- **Verification**: Verified via unit test `rejects priority like attempt by a free user` in `server/test/subscription.test.ts`.

---

### Bug 03: Non-RFC4122 dummy IDs in mobile unit test
- **Severity**: Low (Test failure)
- **Symptom**: `interestSchema.safeParse` in `mobile/tests/subscription.test.ts` failed with `invalid_format: uuid`.
- **Root Cause**: Test fixture passed `'user-2'` and `'trip-2'`, but `interestSchema` enforces strict RFC 4122 UUID formatting via Zod.
- **Fix**: Updated test fixtures to use standard RFC 4122 v4 UUID strings (`a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` and `b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22`). Test passed immediately.

---

### Bug 04: Unused imports flagged by ESLint `--max-warnings=0`
- **Severity**: Low (Lint violation)
- **Symptom**: `npm run lint` flagged unused variables in `paywall.tsx`, `subscription.service.ts`, and `subscription.test.ts`.
- **Root Cause**: Incomplete cleanup of unused icons and unused types during rapid UI prototyping.
- **Fix**: Cleaned up imports across all three files. `npm run lint` now passes with 0 warnings and 0 errors.
