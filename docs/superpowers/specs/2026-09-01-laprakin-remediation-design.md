# Laprakin Remediation Design

## Goal

Improve Laprakin's user-facing parity, security boundaries, maintainability,
and operational visibility through independently reviewable remediation
phases while preserving the private-beta behavior and existing API contracts.

## Scope and sequencing

The work is decomposed into one phase per commit/PR. Fase 0 establishes
evidence and safety. Product and operational quick wins follow, then the
larger client/server architecture phases. Postgres, Redis/BullMQ, and
multi-instance deployment are recorded as a later scale-readiness track;
they are not part of the private-beta remediation until traffic and
concurrency data justify the migration.

The phase order is:

1. Fase 0 — baseline, breakpoint inventory, and lockfile safety.
2. Product parity — edit/regenerate chat messages with backward-compatible
   lineage and API behavior.
3. Content safety — application-level input/output moderation and
   untrusted-document prompt boundaries.
4. Observability — structured request logging, error tracking integration,
   and a health/status surface suitable for an external monitor.
5. Fase 1 — CSS tokens and cascade-layer architecture.
6. Fase 2 — client modularization and state boundaries.
7. Fase 4 — route-based code splitting.
8. Fase 6 — keyboard and screen-reader accessibility.
9. Fase 5 — keyed Indonesian/English translations.
10. Fase 3 — streamed chat responses with a full-response fallback.
11. Fase 7 — security headers, explicit CORS, admin audit log, and optional
    admin TOTP MFA.
12. Fase 8 — semver synchronization and release discipline.

Fase 3 can be implemented independently after Fase 0, but the sequence above
keeps client modularization and route boundaries stable before the streaming
client is extracted.

## Architecture decisions

### Chat revision and regeneration

The existing POST /api/chat/sessions/:id/messages JSON contract remains the
default. A new message action contract will identify a source user message,
truncate only the conversation branch after that message, and create a new
user/assistant pair with revision metadata. Regeneration will reuse the
latest user prompt without creating a duplicate user message. Ownership,
CSRF, rate limits, credit reservation, and cancellation behavior remain
enforced by the existing middleware and service boundaries.

The client will expose edit and regenerate controls beside existing message
actions. Editing uses the same composer with the source content, while
regeneration resubmits the stored prompt. The UI will refresh from the
server's canonical session response after success so a failed branch cannot
silently replace persisted history.

### Content safety and document trust

All document-derived text will be labeled as untrusted source material in
the AI message assembly. A bounded sanitizer will normalize hostile control
characters, preserve academic content, and prevent extracted text from
creating system/developer/user instruction boundaries. Input and generated
output pass through an application moderation seam with provider-independent
decision codes. The seam is configurable for local deterministic rules and
an optional external classifier, with safe user-facing Indonesian messages
for blocked content and no leakage of classifier details.

### Observability and status

The server will emit structured JSON events containing request ID, route,
status, duration, actor class, and error code while excluding credentials,
tokens, document contents, and raw personally identifying payloads. Sentry
integration will be DSN-gated so local development remains functional. The
health endpoint will expose dependency-safe liveness/readiness details and a
status-monitoring document will define the public monitor check and incident
ownership without requiring a vendor account in source control.

### Client CSS and module boundaries

The CSS migration uses the existing markup and the CSS Modules/cascade-layer
option, not a big-bang Tailwind rewrite. Design tokens will live in
client/src/styles/tokens.css. Each section is migrated separately with
explicit layer ownership and a zero-!important target except documented
third-party overrides. Visual verification covers landing, auth, workspace
chat, and admin at mobile, tablet, desktop, and light/dark themes.

Client extraction proceeds from pure utilities and leaf components to
domain contexts/reducers and then page orchestrators. The custom router stays
in place; top-level page modules become lazy boundaries under a shared
loading fallback. No extracted module may depend on the entire Workspace
state when it only needs one domain slice.

### Streaming

The chat endpoint supports Accept: text/event-stream through a
backward-compatible branch. The client uses fetch streaming because the
request is a POST carrying CSRF and JSON body; EventSource remains for
existing admin events. The server relays provider chunks, sends heartbeat
events, persists the final canonical assistant message, and sends a
structured error event if the provider fails after the stream starts. The
client falls back to the existing JSON request path when streaming is
unsupported or interrupted before a usable response.

### Localization, accessibility, and governance

Indonesian remains the default language. A keyed i18n layer will own new and
migrated strings, with English translations for every user-facing key.
Custom controls gain native keyboard semantics or an equivalent tested
interaction contract. Modals return focus to their trigger, notices use
polite live regions, and images receive intentional alternative text.

Security hardening adds Helmet with a CSP verified against existing previews,
explicit CORS origin validation, queryable admin audit rows with hashed IP
metadata, and optional TOTP enrollment/challenge for administrators. Secrets
and document contents are excluded from audit and telemetry payloads.

Release metadata uses one synchronized semver value and monotonically
ordered changelog entries. Every phase adds a user-facing Bahasa Indonesia
entry and preserves the existing behavior unless the phase explicitly
changes the streaming or revision contract.

## Interfaces and verification

Each phase must add failing tests before production code, then pass the
focused test and the full applicable suite. Existing request/response shapes
remain unchanged unless the phase explicitly adds an opt-in content type or
versioned action. CSS phases require manual screenshots at mobile
(<= 760px), tablet, and desktop widths; no bulk deletion of !important is
allowed. Completion requires fresh evidence for tests, builds, API
contracts, visual states, and release files.

## Non-goals for this cycle

The plan does not invent a multi-region control plane, replace SQLite with a
distributed database before scale signals exist, or introduce a queue
service without an operational deployment target. Those changes require a
separate capacity and migration design based on measured traffic,
concurrent-job volume, and backup/restore requirements.
