# Hinge APKM Audit — Product and Architecture Reference

Audit source: `C:\Users\ahiva\Downloads\Hinge.apk.apkm`

The source archive was copied and inspected without modifying the original. The archive identifies Hinge Dating App version `10.6.0`, package `co.hinge.app`, version code `168201286`, Android 10+ / arm64-v8a, with a base APK plus density and ABI splits.

## Inspection method

- Read APKM metadata and split inventory.
- Read Android manifest metadata and permissions with Android `aapt`.
- Enumerated compiled resource names from the base APK.
- Extracted DEX strings and package/class names.
- Decompilation was attempted, but this release is large and its full decompiler pass exceeded the local analysis window. Findings below are based on verified compiled resources, class names, SQL schema strings, permissions, and layout names.
- No Hinge source code, private API credentials, or proprietary assets are copied into Raahi.

## Verified technical shape

### Native shell

- Native Android entry point: `co.hinge.app.ui.AppActivity`.
- Modular package layout by product capability: `discover`, `likesyou`, `standouts`, `matches`, `chat`, `profile`, `preferences`, `safety`, `selfie`, `data_download`, `settings`, and more.
- XML layouts and Android ViewBinding are present alongside Jetpack Compose components and Compose bottom sheets.
- Hilt-generated classes indicate dependency injection boundaries per module.
- Google Sans and Hinge-specific Modern Era / Tiempos fonts are bundled.
- Lottie and media resources support motion-led onboarding, like reactions, loading states, roses, boosts, and standouts.

### Server-driven UI layer

The APK contains `flowService` and `foundation.ube` models including `ScreenResponse`, `ScreenUIElement`, `ScreenType`, and JSON adapters. This indicates that some experiences are delivered as typed, remotely configurable flows rather than hardcoded navigation only.

Raahi should use the same principle for education, consent, paywalls, onboarding tips, and safety notices: server-controlled copy/configuration with a safe native fallback, never server-controlled arbitrary executable UI.

### Local data model

Compiled SQL migrations expose first-class local records for:

- `profiles`
- `profile_media` / `player_media`
- `preference_choices` and dealbreakers
- `discover_batch` / `discover_subject`
- `pending_ratings`
- `matches`
- `messages` / `chat_messages`
- voice-note audio and transcripts
- `standouts_content`
- prompt feedback and prompt polls
- abuse reports and moderation state
- selfie verification state
- subscriptions, offers, boosts, roses, and priority likes

This is a local cache/offline-resilience pattern, not a replacement for the server of record. Raahi’s current Zustand + API structure should evolve toward the same separation: server-owned identity and interaction state, local drafts/cache, explicit sync epochs, and idempotent mutations.

### Platform permissions and trust systems

Verified permissions include:

- camera, microphone, location, contacts
- notifications and background work
- screenshot detection/protection
- selfie/liveness verification
- Google/Firebase sign-in and SMS verification
- billing and purchase verification

Raahi should request each permission at the moment of value, explain why it is needed, persist only the minimum result, and provide a settings recovery path.

## Screen and flow inventory

### Authentication and gating

- Launch / country and age gates.
- SMS login, country selection, resend, invalid-code and too-many-attempts states.
- Google sign-in and account conflict resolution.
- Device verification and email verification.
- Country blocked, age restricted, age signal unknown, ban, appeal, and maintenance states.
- Terms, privacy preferences, tracker consent, and legal disclosures.

### Profile creation and editing

- Required basics: first/last name, birthday, gender, gender identity, pronouns, sexuality, location, height.
- Lifestyle/vitals: children, family plans, education, work, religion, politics, drinking, smoking, marijuana, drugs, pets, languages, zodiac.
- Dating intention and relationship type.
- Media onboarding: photos, ordering, crop/trim, captions, videos, voice prompts, prompt polls.
- Profile review, completeness percentage, verification nudges, top-photo selection, profile polish education.
- Separate edit flows for basics, media, prompts, video prompts, voice prompts, preferences, trait preferences, and match notes.

### Main product navigation

- Discover feed with filters, age, distance, height, gender, dating intentions, new-here, last-active, and location controls.
- Most compatible / curated discovery education.
- Likes You with incoming likes, attached content type, comment context, and match-with-message actions.
- Standouts with a separate recommendation value proposition and paid/limited access.
- Matches list, chat entry, match note, message consent, chat tips, reaction, reply, report, remove, and unmatch.
- Profile Hub with My Hinge, completeness, settings, safety, subscription, help, and account actions.

### Content and interactions

- Like a profile, photo, answer, prompt, poll, video, or voice prompt.
- Attach an optional written comment to a like.
- Send rose / priority-like / super-like variants.
- Undo a skip when eligible.
- Use passing thoughts to explain a skip, save a reframe, or share a thought later.
- Prompt feedback, prompt replacement, prompt polls, voice notes, video prompts, captions, and media suggestions.
- Chat text, reactions, replies, quoted messages, voice notes, transcripts, harmful-content interventions, and conversation nudges.

### Safety, privacy, and account lifecycle

- Report, block, unmatch, past matches, hidden words, mute notifications, screenshot protection.
- Selfie education, consent, liveness scan, retention notice, status, re-verification, and failure/retry states.
- Data export with location selection and email confirmation.
- Pause/snooze account, fresh start, delete account, subscription cancellation, and “We Met” feedback.
- Safety center, crisis resources, community guidelines, privacy controls, tracker details, and support.

### Monetization

- Hinge Plus and Hinge X subscription paywalls.
- Boost and Superboost flows.
- Roses and priority likes.
- Offer cards, timed offers, purchase/restore/error states, tier education, and billing recovery.

## Product principles to carry into Raahi

1. **A profile is a living object.** Every media item and prompt has its own interaction target and editing path.
2. **Likes carry context.** A like should say what attracted the user: profile, photo, prompt, voice, video, trip, or answer.
3. **Matching is a consent boundary.** Chat is unavailable until mutual interest; message consent, report, block, and unmatch are always reachable.
4. **Profile completion is resumable.** Never trap a user in onboarding or erase an unfinished draft when they leave.
5. **Discovery is an explainable queue.** Filters, recommendation source, compatibility, freshness, and pass/undo state must be explicit.
6. **Safety is a product surface.** Verification, reporting, blocking, hidden words, moderation, and account controls are part of the core navigation.
7. **Education is contextual.** Teach a feature immediately before first use, with dismiss, learn-more, and settings recovery paths.
8. **Premium is server-authoritative.** The client may render entitlements but cannot grant boosts, roses, priority, or unlimited actions.
9. **Every asynchronous action has a terminal state.** Loading, success, retry, cancellation, and failure must be reachable on web and native.
10. **Accessibility labels describe the action and target.** “Like Arjun’s photo 2” is better than “heart button.”

## What this audit does not establish

The APK cannot prove private server ranking weights, feature flags, experiment assignments, API contracts, moderation policies, or payment fulfillment rules. Those must be designed explicitly in Raahi rather than inferred as fact.
