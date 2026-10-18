# AGENTS.md

## Test commands
npm run typecheck
npm test
npm run lint
npm run build
npm run smoke:api

Mobile release checks:
`npm --workspace @raahi/mobile run export:web` and `npm --workspace @raahi/mobile run export:ios`
Production configuration check:
`npm --workspace @raahi/mobile run check:production` (requires the real public HTTPS API and legal/support URLs)

## Product references
- `docs/DESIGN_SYSTEM.md` is the implementation design-system contract.
- `docs/MASVS_AUDIT.md` is the mobile security readiness record.
- `docs/APP_STORE_RELEASE.md` is the App Store metadata, signing, hosting, privacy, review, and final-gate plan.
- `docs/HINGE_APKM_AUDIT.md` is the inspected native dating-product capability map.
- `docs/RAAHI_FULL_STACK_RULES.md` is the Raahi product and state-invariant contract.
- `.opencode/skills/raahi-hinge-product-engineering/SKILL.md` is the implementation workflow for Hinge-informed Raahi feature work.

## Loop conventions
- Report-only week one (L1) before enabling auto-fix (L2)
- See LOOP.md for cadence and human gates
