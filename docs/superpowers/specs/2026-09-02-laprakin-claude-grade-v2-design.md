# Laprakin Claude-Grade V2 Design

**Status:** Approved implementation direction

**Audited base:** `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`

**Branch:** `remediation/claude-grade-v2`

## Purpose

This program turns Laprakin's authenticated product into a production-grade AI workspace while preserving its identity, academic-report workflow, existing customer data, and payment behavior. The target is the calm hierarchy, information density, progressive disclosure, keyboard quality, and artifact-oriented working model associated with mature AI workspaces. It does not copy Anthropic names, copy, assets, proprietary fonts, illustrations, or brand elements.

The work is intentionally incremental. Integrity and security defects are resolved before broad visual changes. Each phase leaves a working, testable application and is committed independently.

## Current Evidence

The audited source confirms the following issues on the base commit:

- `client/src/api.js` sends a second mutation when a streaming response is not SSE or finishes without both a delta and a final payload.
- `POST /api/chat/sessions/:id/messages` has no mutation request identifier and persists messages, credit state, and usage without a shared idempotency boundary.
- `defaultChatConfig.configuration.allowExternalAi` is `true`, even though server schemas default consent-like fields to `false`.
- the chat composer submits every unmodified Enter key regardless of `prefs.enterToSend`.
- reactions are client-local and are not represented by a durable message-quality record.
- `I18nRuntime` traverses the rendered DOM and observes mutations, including streaming character changes.
- the legacy admin client blocks its initial screen on one `Promise.all` and uses local tab state instead of stable routes.
- the server returns `naraRouter` while the generic integration panel renders and inspects `gemini`.
- admin authorization is predominantly `role === admin`, not server-side capabilities.
- `client/src/styles.css` contains 4,727 `!important` declarations; redesigned feature styles contain no such declarations yet.
- the production build succeeds but reports a 654.85 kB minified vendor chunk.

The existing test suite is valuable but does not cover these V2 requirements. A green legacy suite therefore remains necessary but is not sufficient evidence.

## Non-Negotiable Invariants

1. The landing implementation, copy, layout, media, responsive behavior, GSAP/Lenis behavior, colors, and timing are frozen. Only CTA font weight, token isolation with identical rendering, non-visual accessibility/security corrections, and proven crash fixes are allowed.
2. Existing account, chat, project, document, upload, generation, revision, quiz, export, billing, credit, referral, notification, feedback, appeal, and admin behavior remains available.
3. One user action creates at most one canonical cost-bearing mutation.
4. Secrets remain server-side, are never returned after save, and never enter logs, audit metadata, browser storage, snapshots, or error messages.
5. External processing requires an explicit, current consent record before transmission.
6. Authorization is enforced by the API. Hidden UI is never treated as authorization.
7. No phase introduces fake metrics, fake providers, decorative AI slop, toast-only persistence, or misleading saved state.
8. New authenticated and admin CSS may not use `!important`.
9. Every defect follows reproduce → failing test → minimal root-cause change → passing test → regression coverage.
10. Completion claims require fresh output from the exact relevant command or rendered workflow.

## Program Decomposition

The program is split into eight independently reviewable subprojects:

1. **P0 integrity and consent:** mutation idempotency, streaming recovery, cancellation, consent, provider truth, composer preference, and reactions.
2. **AI control plane:** provider adapters, secret storage, SSRF-safe egress, model catalog, routing, configuration revisions, activation, health, and rollback.
3. **Design foundation and landing freeze:** landing-specific tokens and visual baselines, typography, semantic colors, workspace/admin tokens, and CSS ownership.
4. **Authenticated workspace:** shell, sidebar, conversation, composer, draft preservation, document split view, uploads, mobile routes, and motion.
5. **Settings and admin:** settings routes, AI data controls, capability RBAC, modular admin routes, privacy defaults, recent-MFA gates, and high-risk approvals.
6. **Accessibility:** WCAG 2.2 AA keyboard, focus, announcements, reflow, zoom, contrast, targets, reduced motion, drag alternatives, and document-preview behavior.
7. **Reliability and performance:** event-driven jobs, reconnectable snapshots, route/library splitting, virtualized histories/previews, observability, backup, and restore.
8. **Release evidence:** explicit CI commands, security scanners, migration checks, production configuration validation, screenshots, landing diffs, rollback evidence, and launch verdict.

Later plans may refine implementation details, but they may not remove or weaken any requirement in this master design.

## P0 Mutation Architecture

### Client request identity

Every cost-bearing action creates a `requestId` once at the user-action boundary. The same value is placed in the JSON body and `Idempotency-Key` header. It is stored with the per-chat draft until the server returns a canonical completed result. Network retry, reload recovery, and manual retry reuse that value; a new user action receives a new value.

`api()` and `apiStream()` accept:

```js
{
  signal,
  timeoutMs,
  requestId,
  onDelta,
  onState,
}
```

Timeout and caller cancellation are combined without losing the abort reason. A non-SSE response is parsed from the original response object. An incomplete SSE response never resends the POST. Instead, the client requests the canonical mutation snapshot by request ID. The UI distinguishes `interrupted`, `retryable`, `canonical-completed`, and `canceled` states.

### Server mutation ledger

Add a durable `mutation_requests` table with:

- `request_id`, `owner_user_id`, and `operation` as a unique key;
- a normalized request hash that detects accidental key reuse with different input;
- resource type and resource ID;
- `processing`, `completed`, `retryable_failed`, `terminal_failed`, or `canceled` state;
- canonical HTTP status and response JSON;
- configuration revision, provider ID, model ID, and prompt-template revision where applicable;
- started, updated, and completed timestamps.

The chat endpoint acquires the mutation record before reserving credit or persisting a message. A completed replay returns its stored canonical response. A concurrent replay receives the canonical completed result when available or a typed `MUTATION_IN_PROGRESS` response with a snapshot URL. Reusing a key with a different normalized request hash returns `409 IDEMPOTENCY_KEY_REUSED`.

The user message, assistant message, AI usage event, job, and credit operation each store the same request ID. Database writes that establish the canonical exchange occur in one SQLite transaction. Provider calls occur outside long database transactions; the durable mutation state bridges that boundary.

### Stream recovery

SSE frames include the request ID and monotonically increasing event ID. The final frame contains the canonical response. Client disconnect aborts the upstream request when possible and marks the ledger according to whether a canonical result was committed. Partial assistant text is retained only as an explicitly interrupted, non-billable draft unless the canonical assistant message was committed.

## Provider Manifest and Consent

The server exposes one public processor manifest generated from the active runtime configuration. It contains stable provider IDs, display names, processor purpose, data classes, policy version, manifest version, retention/training statements, and user-facing product-mode mappings. Generic UI never branches on `gemini` or `naraRouter` property names.

Consent defaults to absent/false. Before the first external transmission, the server requires a record containing user ID, processor/provider IDs, data classes, policy version, manifest version, timestamp, and source surface. A materially changed processor, data class, or policy invalidates prior consent. Settings can review and revoke consent; revocation prevents new external requests without deleting unrelated chat data.

Legal content, Settings Data Controls, composer status, and admin health all consume the same server manifest.

## Message Reactions

Create a privacy-safe `message_reactions` record keyed by owner and message. It stores reaction value, optional structured reason code, request ID, provider ID, model-configuration revision, prompt-template revision, and timestamps. Repeating the selected reaction removes it; switching replaces it. The client updates optimistically only with rollback and announces success only after persistence. Normal admin analytics expose aggregates and pseudonymous references, never raw conversation content.

## AI Control Plane

### Boundaries

The control plane lives outside `server/src/index.js` in focused modules:

- provider manifest and adapter registry;
- provider configuration repository;
- secret-store interface and implementations;
- outbound URL policy and guarded fetch client;
- model catalog and capability evidence;
- route assignment and validation;
- configuration revision, activation, and rollback service;
- capability middleware and audit service.

Initial adapters are NaraRouter/OpenAI-compatible, the existing Cloudflare fallback where supported by current code, and a generic OpenAI-compatible adapter only after its endpoint passes server-side validation and canary tests.

### Secret storage

Production prefers Azure Key Vault through managed identity. The self-hosted/development implementation uses AES-256-GCM with a dedicated 32-byte `AI_CREDENTIAL_MASTER_KEY`, a random 12-byte IV, a 16-byte authentication tag, ciphertext and key versions, and AAD containing provider ID and secret version. Decryption rejects malformed lengths and fails if authentication does not complete. Production fails closed when neither vault configuration nor the dedicated key is available.

Only fingerprint, last four characters, timestamps, actor, version, and opaque reference are persisted with provider configuration. Credential forms clear after successful replacement and cannot reveal the prior value.

### SSRF-safe outbound access

Production provider URLs require HTTPS, no credentials, no fragments, and an allowed port. Known provider hosts use an allowlist. Custom hosts require owner capability and a deployment allowlist. Every resolved address is validated against loopback, private, link-local, multicast, unspecified, and metadata ranges for IPv4 and IPv6. The guarded client pins validated resolution for the connection, disables redirects by default, validates every explicitly allowed redirect, caps response bytes, and applies separate connection, model-list, and inference timeouts.

### Configuration lifecycle

Provider and route edits create immutable drafts. Server-side connection, model-discovery, capability, and synthetic canary tests produce evidence bound to the draft revision. Activation requires the relevant capability, recent MFA, impact preview, audit event, and atomic pointer change. In-flight work stores and continues using its starting revision. The previous active revision remains last-known-good and can be restored atomically.

Product-facing modes stay `Basic`, `Thinking`, and `XtraThink`; raw provider/model IDs remain an admin concern.

## Capability Authorization and Admin Privacy

Roles resolve to a server-side capability set containing at least every capability listed in the mission. Each admin API declares its required capability through middleware. The client fetches the effective capability manifest only to render affordances; API decisions remain authoritative.

Operational admin responses use pseudonymous user references. Email, full name, room title, chat content, and file content are omitted by default. PII reveal is a separate recent-MFA action requiring capability, reason, bounded duration, and a dedicated audit event. Content access is a distinct break-glass capability.

High-risk commands use request IDs, impact previews, reason codes, notes, recent MFA, audit, affected-user notification, and typed confirmation where irreversible. The specified production-provider, retention, pricing, bulk, role, export, and security-control actions also require a second approval record.

## Authenticated Information Architecture

### Workspace shell

Desktop uses a 260–280 px expanded sidebar, 64–72 px collapsed rail, a centered 760–860 px reading column, and a 480–620 px resizable document panel. Assistant content renders directly on the canvas; user messages use restrained right-aligned treatment. The composer remains stable while streaming.

The sidebar contains Laprakin brand, new chat, chats, projects, documents, searchable recent history, pins, and account/settings/help actions. It does not color every icon or surface with the selected accent.

Tablet uses an overlay/compact navigation treatment. On mobile, navigation is an accessible modal and the document becomes a full-screen route/sheet. The composer respects safe areas and the software keyboard at 360 px and 390 px widths.

### Composer and drafts

Composer keyboard behavior is a pure tested function. With `enterToSend=true`, Enter sends and Shift+Enter inserts a newline. With it false, Enter inserts a newline and Ctrl/Cmd+Enter sends. Composition events never send. The mode menu follows the complete menu keyboard contract and has no timer-based dismissal.

Per-chat drafts live in IndexedDB and include text, mode, project/context, editing state, request ID, and recoverable attachment-staging metadata. Drafts clear only after canonical acknowledgement. Refresh, session expiry, timeout, chat switching, and reauthentication do not discard user work.

Uploads expose per-file progress, cancel, retry, remove, and exact failures. No file is silently removed through array slicing.

### Document experience

The right panel owns Preview, Outline, Sources, Checks, History, version, export, and close controls. Review state binds to an exact content signature and explicit user action; clients never silently set `confirmReviewed`. Export binds to the reviewed revision and preserves download history.

The chat and document share a canonical workflow state machine with connecting, queued, reading sources, generating, checking, saving, complete, retrying, interrupted, and canceled states. Auto-scroll follows only while the user remains near the bottom.

## Settings and Admin Routes

Settings use stable nested route/query state for every mission category, respect system/light/dark/high-contrast/reduced-motion preferences, and expose actual persistence state with rollback on failure. Data Controls render the canonical processor manifest and consent record.

Admin uses stable routes for all listed modules. Each route is lazy, paginated, filterable, independently loaded, and wrapped by its own skeleton, error boundary, retry action, and last-updated indicator. No unrelated CMS, feedback, audit, usage, user, or alert request blocks another module.

## Design Foundation

Plus Jakarta Sans Variable is the application font. DM Mono is limited to real 400/500 weights. Normal functional text is at least 12 px. Warm neutral canvases, restrained elevation, and neutral iconography are shared between workspace, Settings, and Admin.

Tokens are separated into `--landing-accent*`, `--workspace-accent-*`, `--admin-accent-*`, and semantic status colors. Status colors never derive from user accent. Workspace accents are limited to the curated palette and are used sparingly for selection, primary action, and focus—not every card, icon, border, avatar, or hover.

Feature-owned styles use cascade layers and do not reach into unrelated components. Compatibility rules are removed only after rendered comparison.

## Landing Freeze

Before any approved landing edit, capture desktop and mobile screenshots after `document.fonts.ready`. Record CTA bounding boxes and computed font family/weight for button and child span. After changes, mask only those bounding boxes and require zero pixels changed elsewhere. Repeat with workspace accent and theme preferences changed to prove the landing remains lime/mint and preference-independent.

Hero and final CTA use the existing Plus Jakarta variable font at weight 700 or 800 if screenshot evidence shows 700 remains visually too light. No dimensions, color, gradient, shadow, position, text, or motion may change.

## Accessibility and Motion

WCAG 2.2 AA evidence is behavioral. Required browser coverage includes keyboard-only primary workflows, focus visibility and return, inert modal backgrounds, Escape, no focus obstruction, live streaming/upload announcements, target size, error descriptions, 320 px reflow, 200%/400% zoom, high contrast, reduced motion, and pointer alternatives for every drag action.

Authenticated motion uses opacity and 4–8 px translation within the mission's duration ranges. It avoids bounce, elastic movement, large zoom, pulsing, animated gradients, typing simulation, and scroll hijacking.

## Reliability and Performance

Document jobs use SSE as primary transport with event IDs, canonical snapshots, heartbeats, reconnect, and exponential-backoff polling only as fallback. The fallback is visibility-aware and cannot poll every ~650 ms for minutes.

Admin routes, PDF/DOCX libraries, and heavy preview code are lazy. Long histories and PDF pages are virtualized. Streaming updates are batched. Bundle reports identify and budget large chunks rather than hiding warnings.

Backups and restores include encrypted secret references, configuration revisions, consent, mutation ledgers, documents, billing, and audit metadata without exporting secret plaintext.

## Verification and Release

Root scripts expose every command named in the mission. Pull-request CI runs clean install, full lint/typecheck, server/client/integration tests, production build, browser E2E, accessibility, landing freeze, visual regression, Semgrep, Gitleaks, dependency audit, Trivy, migration smoke, production configuration, and backup/restore. Production deployment consumes an immutable artifact and cannot advance after a failed gate.

Each phase records exact commands, exit codes, pass/fail/skip counts, warnings, screenshots, migrations, and residual risk in the required audit/runbook documents. The final verdict is `GO`, `CONDITIONAL GO`, or `NO-GO`; it is never inferred from a narrow unit-test result.

## Reference Decisions

- Anthropic's public artifact documentation validates a dedicated right-hand work surface for substantial editable content, without requiring Laprakin to copy proprietary assets or wording.
- Anthropic's public project documentation validates project-scoped histories and knowledge, while Laprakin retains its academic project semantics.
- OWASP SSRF guidance supports allowlisted destinations, strict parsing, redirect controls, DNS/IP validation, and isolation of outbound fetch behavior.
- OWASP ASVS 5 configuration guidance supports documented connection limits, bounded retries/timeouts, a managed secret store, least privilege, and rotation.
- W3C WCAG 2.2 adds the focus-not-obscured, dragging-alternative, target-size, redundant-entry, and accessible-authentication requirements covered by this design.
- Node.js 22 documentation confirms authenticated decryption fails at `decipher.final()` for invalid tags, supports explicit GCM authentication-tag length, and provides `AbortSignal.any()`/`AbortSignal.timeout()` for composable cancellation.

## Acceptance

The program is accepted only when every numbered definition-of-done item in the mission has direct current-state evidence and every required artifact exists. Missing or indirect evidence is an incomplete requirement, not a pass.
