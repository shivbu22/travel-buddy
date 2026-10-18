# Loop safety policy

This project runs Loop Engineering at **L1 report-only** during the first week. It may inventory issues and update `STATE.md`, but it must not auto-edit, merge, deploy, or close issues.

## Human approval required

- Authentication, authorization, session, OTP, Apple Sign In, and verification code paths.
- Secrets, `.env` files, credentials, signing, encryption, and certificate configuration.
- Upload privacy, moderation, account deletion, export, location, contacts, and notification behavior.
- Database schemas, migrations, Docker/deployment/CI infrastructure, and dependency upgrades.
- Design-system primitives and shared tokens when the change affects multiple product surfaces.
- Any change that weakens a test, security header, or production environment check.

## Connector scope

Use read-only GitHub/issue/CI access for triage. Comment-only access requires human request. No connector may publish credentials, merge pull requests, or deploy production artifacts.

## Verification gate

Every proposed code change must include the smallest applicable verifier: typecheck, tests, lint, API smoke, and relevant Expo export. A verifier must report failures honestly; retries do not count as remediation.
