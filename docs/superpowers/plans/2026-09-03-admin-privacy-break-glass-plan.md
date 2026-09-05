# Admin privacy and break-glass implementation plan

## Goal

Make routine Admin operations pseudonymous and keep identity/content disclosure behind separate, short-lived, server-enforced, recently-MFA-verified grants with dedicated audit events.

## Acceptance contract

- [x] The `admin` role does not receive PII or content-reveal capabilities merely because it is an admin.
- [x] User, appeal, alert, AI-usage, credit, and broadcast responses use a stable `userRef` and omit email/full name by default.
- [x] User-room responses omit room titles and expose a stable `roomRef` only.
- [x] Existing alert summaries are redacted before delivery so embedded email addresses cannot bypass the response boundary.
- [x] PII reveal requires `users.pii.reveal`, recent MFA, a reason code, a note, and a grant of at most ten minutes.
- [x] Chat/content reveal requires the separate `users.content.reveal` capability and the same bounded break-glass controls.
- [x] Grant creation, every protected read, revocation, and expiry denial are covered by server tests and dedicated audit actions.
- [x] The Admin UI never persists revealed data and clears it when the grant expires or the selected user changes.
- [x] Browser coverage proves ordinary admins cannot see seeded PII/content and cannot invoke reveal actions.
- [x] RBAC and operational behavior are documented in `docs/security/admin-rbac.md`.
- [x] Server, client, lint, typecheck, build, Admin browser checks, and Landing freeze remain green.

## Execution sequence

1. Add failing capability and API privacy tests.
2. Add the durable break-glass grant model and least-privilege role mapping.
3. Redact default Admin APIs and add separate protected read routes.
4. Update Admin components to render pseudonymous references and an ephemeral reveal surface.
5. Extend browser verification and document the boundary.
6. Run focused checks, then the full regression gates; update audit/changelog and commit the checkpoint.
