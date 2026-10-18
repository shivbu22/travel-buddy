# Raahi product and release audit

Audited: 2026-10-09  
Market: India-first, iOS-first travel dating  
Core promise: decide where to go → find a compatible travel partner → match the vibe → plan a safe first meet → share the journey.

## Release-ready flows

- Phone OTP authentication with international formatting and Indian `+91` default input.
- 18+ profile gate.
- Three-to-six profile photos with JPEG conversion for iPhone formats.
- Profile prompts, travel style, pace, languages, intent, relationship intention, and safety boundaries.
- Indian language choices: Hindi, Bengali, Marathi, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, Urdu, and English, with room for additional languages.
- Destination-first trip setup with India-focused starter destinations including Goa, Jaipur, Kochi, and Leh.
- INR-first budgets, optional USD/EUR/JPY support, date flexibility, and minimum three-day overlap.
- Discovery filtered server-side by destination, dates, budget, style, pace, reciprocal safety, block state, onboarding, phone/account verification, and selfie approval.
- Profile, prompt, photo, normal-interest, and once-daily Super Interest actions.
- Mutual-interest-only chat with persisted messages, Socket.IO delivery, polling fallback, and duplicate-send protection.
- Trip context remains visible in chat, with first-meet safety guidance and conversation starters.
- Travel Journal with one-to-six image carousel posts, destination context, captions, likes, comments, story reporting, and owner deletion.
- Private location permission only when the user asks to resolve a city; exact coordinates never enter discovery cards.
- Private contact permission only for an invitation action; contacts are not uploaded or matched.
- Identity review is a human-review workflow. Selfies are private and not served from the public uploads directory.
- Report, block, unblock, unmatch, account deletion, and private moderation queues.

## Security and privacy decisions

- Access and refresh sessions are stored as hashes; refresh tokens rotate.
- OTP challenges expire, limit attempts, and are consumed after successful verification.
- Uploads are checked by file signature, not only client MIME type.
- Upload size is limited to 8 MB per image; profile uploads are resized on-device.
- Public media is separate from private verification media.
- Block relationships hide profiles, terminate matches, and prevent Journal interactions.
- Chat authorization is enforced on every message read/write and WebSocket join.
- No background location, precise coordinates in public UI, contact syncing, automated facial recognition, or liveness claim.

## Expo/device runtime

- Local mobile API is plain HTTP: `http://<computer-LAN-IP>:4000/v1`.
- The app normalizes stale local HTTPS values back to HTTP for private LAN addresses.
- API and Metro ports are separate: API `4000`, Expo `8081`.
- `npm run mobile:lan` starts Metro in LAN mode with a low worker count for Windows/OneDrive stability.
- A full `--clear` launch can take one to three minutes on the first build. Do not scan until `http://<computer-LAN-IP>:8081` responds.
- Settings → App connection shows the active API host and tests API/database health.

## Validated on the development machine

- PostgreSQL and Redis Docker services running.
- Four Prisma migrations applied, including the Journal migration.
- Seed data loaded.
- API health reports `status: ok` and `database: ok`.
- Authenticated profile image upload and public image retrieval passed.
- Journal create, carousel media, feed, like, comment, report, and delete flow passed against PostgreSQL.
- Mobile typecheck passed.
- Server typecheck passed.
- Contracts typecheck passed.
- Mobile tests passed: 4/4.
- Server tests passed: 4/4, including the database integration flow.
- Server build passed.
- iOS Expo export passed.
- Expo Doctor passed: 21/21.
- LAN TCP checks passed for ports 4000 and 8081.

## Before production

1. Replace development OTP with Twilio Verify and add abuse monitoring.
2. Replace local JWT secret, admin token, and filesystem uploads with managed secrets, object storage, and a private verification bucket.
3. Deploy behind HTTPS; remove local HTTP exceptions from release builds.
4. Add Apple Sign In production credentials and an EAS/native development build for Apple and push testing.
5. Add a real admin console for selfie review, reports, appeals, and audit logs.
6. Add content moderation/rate controls for public Journal posts and comments.
7. Add legal/privacy review for India: consent, retention/deletion language, grievance contact, and age/safety policy.
8. Test with Indian users across Hindi/English copy, low-bandwidth mobile networks, Android devices, and regional date/number expectations.
