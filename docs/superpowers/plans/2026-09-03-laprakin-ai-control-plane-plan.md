# Laprakin Secure AI Control Plane Implementation Plan

> Status: in progress. This plan starts only after the P0 integrity checkpoint at `a73f590` and keeps the Landing freeze intact.

**Goal:** Replace static, process-wide AI configuration with a secure, adapter-based, revisioned control plane that administrators can test, activate, observe, and roll back without exposing credentials or silently changing a user's disclosed processors.

**Architecture:** Focused server modules own capabilities, secrets, guarded egress, provider adapters, configuration persistence, model evidence, activation, routing, and runtime snapshots. Admin APIs remain authoritative and require named capabilities plus recent MFA for sensitive mutations. The current environment configuration remains a read-only bootstrap revision until a tested admin-managed revision is activated.

**Verification discipline:** Every task starts with a failing contract or integration test, implements the smallest production behavior, runs focused tests, then commits. Complete server/client/build checks close the phase. Synthetic provider fixtures never contain user content or real credentials.

## Invariants

- No complete provider credential is stored in plaintext, returned by a GET endpoint, logged, audited, exposed to Sentry, or embedded in the client.
- Production fails closed unless Azure Key Vault or a dedicated 32-byte `AI_CREDENTIAL_MASTER_KEY` is configured.
- Admin-supplied URLs are untrusted. Production uses HTTPS, host/deployment allowlists, DNS/IP validation, redirect rejection, byte caps, and bounded timeouts.
- Provider/model configuration is immutable after creation. Only an atomic active-revision pointer changes.
- Drafts never affect live traffic. Activation requires fresh test evidence, valid route assignments, capability, recent MFA, reason, impact preview, and audit.
- In-flight work retains its captured revision. New work sees the new active revision.
- A fallback provider must already appear in the user's active processor consent; otherwise the request degrades without silent rerouting.
- Product modes remain Basic, Thinking, and XtraThink. Raw provider/model IDs are Admin-only details.
- The Landing page and its asset/style baseline remain frozen.

## Task 1: Establish server-side capability authorization

**Files:**
- Create: `server/src/admin-capabilities.js`
- Test: `server/test/admin-capabilities.test.mjs`
- Modify: `server/src/index.js`
- Test: `server/test/admin-authorization-api.test.mjs`

**Interfaces:**
- `ADMIN_CAPABILITIES`: the mission's complete stable capability set.
- `capabilitiesForUser(user)`: returns the effective server-side set.
- `requireCapability(capability)`: Express middleware; denial is `403 ADMIN_CAPABILITY_REQUIRED` without resource disclosure.

- [ ] Write a failing matrix test for every required capability and role.
- [ ] Implement immutable role-to-capability mappings with `admin` retaining legacy access while narrower operational roles can be added without client trust.
- [ ] Add `GET /api/admin/capabilities` and protect representative AI, user, billing, CMS, audit, retention, incident, and role routes with named capabilities.
- [ ] Prove frontend visibility is irrelevant by calling protected routes directly as unauthorized users.
- [ ] Run focused authorization and existing admin MFA tests.
- [ ] Commit: `feat: enforce admin capabilities server side`.

## Task 2: Build authenticated secret storage

**Files:**
- Create: `server/src/ai-secret-store.js`
- Test: `server/test/ai-secret-store.test.mjs`
- Modify: `server/src/config.js`
- Modify: `server/src/db.js`
- Modify: `scripts/production-config-check.mjs`

**Interfaces:**
- `SecretStore.put({ providerId, value, actorUserId })`
- `SecretStore.get({ providerId, reference, version })`
- `SecretStore.delete({ providerId, reference, version })`
- `createEnvelopeSecretStore({ masterKey, keyVersion, store })`
- `createProductionSecretStore(config)` with Azure Key Vault preference and envelope fallback.

- [ ] Write red tests for AES-256-GCM round-trip, 12-byte IV, 16-byte tag, AAD binding, key/version mismatch, malformed ciphertext, rotation, deletion, metadata masking, and absence of plaintext in SQLite/audit/error output.
- [ ] Add a metadata table containing opaque reference, provider ID, secret/key versions, fingerprint, last four, actor, created/rotated/deleted timestamps, IV/tag/ciphertext for the envelope implementation, and no plaintext column.
- [ ] Derive no key from JWT/device/token/MFA/CSRF material. Accept only an independently configured 32-byte base64/hex master key.
- [ ] Fail closed in production without an external vault or valid dedicated key; permit an explicit ephemeral test store only in test/development.
- [ ] Ensure successful replacement returns only `Configured •••• ABCD` metadata and credential inputs can be cleared by the client.
- [ ] Run focused tests plus production configuration checks.
- [ ] Commit: `feat: add authenticated ai secret storage`.

## Task 3: Guard all configurable provider egress

**Files:**
- Create: `server/src/ai-egress-policy.js`
- Create: `server/src/guarded-provider-client.js`
- Test: `server/test/ai-egress-policy.test.mjs`
- Test: `server/test/guarded-provider-client.test.mjs`
- Modify: `server/src/config.js`

**Interfaces:**
- `validateProviderUrl(input, policy)`
- `resolveAndValidateHost(hostname, { lookup, allowedHosts, customAllowedHosts })`
- `guardedProviderRequest({ url, method, headers, body, timeoutMs, maxBytes, policy, fetchImpl })`

- [ ] Write red tests for HTTP, credentials, fragments, disallowed ports, localhost aliases, IPv4/IPv6 loopback/private/link-local/multicast/unspecified/metadata addresses, decimal/hex/octal encodings, internal suffixes, multi-answer DNS, rebinding, redirect targets, oversized responses, and timeout categories.
- [ ] Implement strict URL canonicalization and known-host allowlisting. Custom hosts require both owner capability and `AI_CUSTOM_PROVIDER_HOSTS` deployment allowlisting.
- [ ] Validate every DNS answer and pin the approved resolution for the connection; reject redirects by default.
- [ ] Return sanitized DNS/TLS/auth/rate-limit/model/timeout codes without headers, bodies, addresses, or credentials.
- [ ] Run focused tests and an external-network-disabled fixture integration.
- [ ] Commit: `feat: guard provider egress against ssrf`.

## Task 4: Persist immutable provider and routing revisions

**Files:**
- Create: `server/src/ai-configuration-repository.js`
- Create: `server/src/ai-routing.js`
- Test: `server/test/ai-configuration-repository.test.mjs`
- Test: `server/test/ai-routing.test.mjs`
- Modify: `server/src/db.js`

**Interfaces:**
- Provider revisions with adapter type, canonical base URL, state, limits, secret reference, test metadata, actor metadata, and immutable revision ID.
- Per-provider model catalog with source, enable/archive state, explicit capability evidence, limits, health, and optional cost metadata.
- Route assignments for every mission route with primary, ordered fallbacks, requirements, limits, reasoning effort, cost class, and plan availability.
- Atomic active and last-known-good revision pointers.

- [ ] Write red migration/repository tests proving drafts are immutable, secrets are references only, catalogs are per-provider, and pointer swaps are atomic.
- [ ] Implement provider states `draft`, `tested`, `active`, `degraded`, `disabled`, and `archived` with legal transition validation.
- [ ] Validate routes: verified vision/schema evidence, enabled provider/model, no duplicate fallback, and complete production-required coverage.
- [ ] Map all product/purpose combinations to the mission route IDs without exposing model IDs to users.
- [ ] Run focused repository/routing/migration tests.
- [ ] Commit: `feat: persist revisioned ai configuration`.

## Task 5: Introduce provider adapters and per-provider discovery

**Files:**
- Create: `server/src/ai-providers/adapter-registry.js`
- Create: `server/src/ai-providers/openai-compatible.js`
- Create: `server/src/ai-providers/cloudflare-ai.js`
- Test: `server/test/ai-provider-adapters.test.mjs`
- Modify: `server/src/ai.js`
- Modify: `server/src/integrations.js`

**Interfaces:**
- Adapter contract: `testConnection`, `discoverModels`, `runCanary`, `complete`, `stream`, `normalizeError`.
- Initial adapters: NaraRouter/OpenAI-compatible, existing Cloudflare AI fallback, and generic OpenAI-compatible only behind the guarded-host policy.

- [ ] Write red contract tests shared by every adapter, including streaming, cancellation, structured output, vision evidence, bounded payloads, and sanitized errors.
- [ ] Move provider-specific URL/token/body/error logic out of `ai.js` into adapters using the guarded client.
- [ ] Persist discovery source and capability evidence per provider. Unknown critical capabilities are `unverified`, never guessed as verified from model names.
- [ ] Permit manual model IDs/overrides only with explicit evidence state and audit-ready metadata.
- [ ] Preserve the current environment NaraRouter and Cloudflare behavior through bootstrap adapters.
- [ ] Run adapter, stream, truncation, content-safety, and integration tests.
- [ ] Commit: `refactor: add guarded ai provider adapters`.

## Task 6: Implement draft, test, activate, and rollback lifecycle

**Files:**
- Create: `server/src/ai-configuration-service.js`
- Create: `server/src/ai-configuration-validation.js`
- Test: `server/test/ai-configuration-service.test.mjs`
- Modify: `server/src/processor-manifest.js`
- Modify: `server/src/external-ai-consent.js`

**Interfaces:**
- `createDraft`, `replaceCredential`, `testDraft`, `discoverDraftModels`, `runDraftCanaries`, `previewActivation`, `activateRevision`, `rollbackRevision`, `captureActiveConfiguration`.

- [ ] Write red lifecycle tests proving drafts do not affect runtime, tests use only synthetic Laprakin-owned content, evidence expires after ten minutes, failed drafts preserve last-known-good, activation/rollback are atomic, and restart reloads the active pointer.
- [ ] Bind test evidence and route diffs to immutable revisions and actor/reason metadata.
- [ ] Require recent MFA and capability in the API layer, with second-approval hooks for production-provider replacement.
- [ ] Rebuild the processor manifest from the captured active runtime revision and invalidate consent only for material processor/data/policy changes.
- [ ] Prove in-flight snapshots retain the starting revision while later requests see the activated revision.
- [ ] Run lifecycle, consent, and mutation-metadata tests.
- [ ] Commit: `feat: activate and roll back ai revisions`.

## Task 7: Adopt runtime snapshots and complete usage telemetry

**Files:**
- Modify: `server/src/ai.js`
- Modify: `server/src/services.js`
- Modify: `server/src/index.js`
- Modify: `server/src/db.js`
- Test: `server/test/ai-runtime-configuration.test.mjs`
- Test: `server/test/ai-usage-privacy.test.mjs`

- [ ] Write red tests for precedence: active tested revision, environment bootstrap, then disabled/unavailable.
- [ ] Capture one configuration snapshot at request/job start and pass it through route selection, adapter calls, streaming, worker execution, mutation metadata, and reaction metadata.
- [ ] Record provider ID, configuration revision, model ID, route, product mode, latency, token usage, fallback count/reason, and error code—never prompt/output content.
- [ ] Enforce consent-aware fallback and explicit degraded-state errors when no disclosed route remains.
- [ ] Add circuit state and queue-depth snapshots without leaking provider responses.
- [ ] Run existing AI/chat/document workflows plus new runtime/privacy tests.
- [ ] Commit: `refactor: run ai from captured configuration revisions`.

## Task 8: Expose secure Admin AI APIs

**Files:**
- Create: `server/src/admin-ai-routes.js`
- Test: `server/test/admin-ai-control-plane-api.test.mjs`
- Modify: `server/src/index.js`

**Routes:**
- `/api/admin/ai/providers`
- `/api/admin/ai/providers/:providerId`
- `/api/admin/ai/models`
- `/api/admin/ai/routing`
- `/api/admin/ai/health`
- `/api/admin/ai/changes`

- [ ] Write red direct-API tests for view/manage/rotate/model/routing/health capabilities, CSRF, recent MFA, typed confirmation, disabled-before-key-deletion, reason, pagination, and secret-free responses.
- [ ] Implement independent paginated/filterable endpoints and bounded test/discovery/canary operations.
- [ ] Add activation impact preview, immutable change history, emergency disable/kill switch, and rollback; high-risk actions require explicit reason and audit.
- [ ] Ensure GET responses expose only environment-configured state, safe fingerprints, health, revisions, models, routes, and aggregate telemetry.
- [ ] Run API tests plus all admin authorization/MFA/audit tests.
- [ ] Commit: `feat: add secure admin ai control plane api`.

## Task 9: Build route-backed Admin AI modules

**Files:**
- Create: `client/src/pages/Admin/ai/*`
- Create: `client/src/lib/admin-ai.js`
- Test: `client/test/admin-ai-contract.test.mjs`
- Modify: `client/src/pages/Admin/AdminWorkspace.jsx`
- Modify: `client/src/pages/Admin/LegacyAdminWorkspace.jsx`
- Modify: `client/src/i18n/id.json`
- Modify: `client/src/i18n/en.json`
- Modify: `client/src/styles/admin.css`
- Test: `scripts/ui-workflow-check.py`

- [ ] Write red route/API/UI contract tests for stable deep links, lazy modules, independent loading/error/retry/last-updated states, pagination/filter state, capability-driven affordances, and password-only credential inputs.
- [ ] Implement calm, compact provider, model, routing, health, and change-history modules without loading unrelated CMS/user/feedback data.
- [ ] Clear credential form state after success; never implement reveal-after-save or place credentials in browser storage.
- [ ] Provide explicit draft/test/canary/impact/activate/rollback states and accessible confirmations.
- [ ] Verify desktop, 390 px mobile, keyboard-only, screen-reader names, theme modes, reduced motion, and failure recovery in the browser.
- [ ] Run client tests, lint, typecheck, and build.
- [ ] Commit: `feat: add modular admin ai configuration`.

## Task 10: Close the AI control-plane phase

**Files:**
- Modify: `docs/audits/full-ux-security-audit.md`
- Create: `docs/security/ai-secret-management.md`
- Create: `docs/runbooks/ai-provider-rotation.md`
- Create: `docs/runbooks/ai-provider-outage.md`
- Modify: `docs/runbooks/rollback.md`
- Modify: `CHANGELOG.md`

- [ ] Run all focused control-plane, capability, consent, chat, document, and Admin tests from fresh processes.
- [ ] Run complete server/client suites, lint, typecheck, production build, API E2E, browser E2E, production-config validation, migration smoke, secret scan, and dependency audit.
- [ ] Record privacy-safe database evidence for encrypted secrets, immutable revisions, active/LKG pointers, usage revision metadata, and zero secret/plaintext prompt in audit/telemetry.
- [ ] Exercise and document provider rotation, outage/kill switch, activation failure, and one-click rollback.
- [ ] Record screenshots and exact pass/fail/warning counts; leave any unproved requirement open.
- [ ] Commit: `docs: record ai control plane evidence`.

## Phase Exit Gate

The phase is complete only when an administrator with the right server-side capability can create a draft, store/rotate a non-revealable credential, pass guarded connection/model/canary tests, preview and atomically activate a revision under recent MFA, observe secret-free health/usage, and roll back to last-known-good—while concurrent in-flight work keeps its original revision and processor consent always reflects the active runtime processors.
