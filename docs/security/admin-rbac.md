# Admin RBAC and Break-Glass Access

Laprakin keeps routine Admin operations pseudonymous. Admin list, appeal, alert,
credit, broadcast, usage, and room-metadata responses expose stable references
(`userRef` and `roomRef`) and do not include email addresses, full names, room
titles, or message bodies.

## Roles and capabilities

- `admin`: routine Admin operations, including user lookup, moderation, billing,
  appeals, alerts, and audit views. This role cannot reveal PII or room content.
- `privacy_admin`: `users.view`, `users.pii.reveal`, `audit.view`, and
  `retention.execute`. This role can reveal identity data only through a
  time-bound break-glass grant.
- `content_forensics_admin`: `users.view`, `users.content.reveal`,
  `audit.view`, and `incidents.manage`. This role can reveal room content only
  through a separate time-bound break-glass grant.
- `owner`: full capability set, subject to the same MFA, reason, duration, and
  audit requirements for protected reads.

## Break-glass rules

Protected access requires all of the following:

1. The capability matching the requested scope (`pii` or `content`).
2. A recent step-up MFA verification.
3. A reason code and an operator note of at least 12 characters.
4. A grant lasting between 1 and 10 minutes.

PII and content grants are independent. A PII grant cannot read room content,
and a content grant cannot read identity data. The Admin UI keeps revealed data
in memory only, clears it when the grant expires or the selected subject
changes, and provides an explicit revoke action.

## Audit and operations

Grant creation, each protected read, revocation, and denied/expired access are
recorded as dedicated admin audit events:

- `admin.pii_access_granted`, `admin.pii_accessed`
- `admin.content_access_granted`, `admin.content_accessed`
- `admin.break_glass_revoked`, `admin.break_glass_access_denied`

Operators should include a support case, security incident, legal request, or
data-subject request in the reason code. Investigations must use the audit event
ID and references in tickets; do not copy raw PII or message content into
operational notes.
