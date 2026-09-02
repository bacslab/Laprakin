# Laprakin Full UX and Security Audit

## Audit Method

This is a living evidence register. Findings are closed only by source inspection, a failing reproduction, a root-cause change, focused passing coverage, the relevant complete suite, and rendered/runtime evidence where the requirement is behavioral. Legacy green tests are supporting evidence, not automatic closure.

## AUDIT-001 — Stream fallback can duplicate a mutation

- Severity: P0
- User impact: duplicate messages, provider usage, credit operations, jobs, or documents after content-type rewriting, disconnect, reload, retry, or double click.
- Evidence: `client/src/api.js` calls `api(path, requestOptions)` when the original response is not SSE and when the stream ends without the expected event combination. The server message schema has no request ID.
- Reproduction: behavioral fetch-count and concurrent API tests are introduced in the P0 plan.
- Root cause: transport parsing is coupled to mutation retry and the server has no canonical mutation ledger.
- Changed files: not implemented.
- Fix: planned durable request ledger, original-response parsing, canonical snapshot recovery, and one request ID across messages, usage, jobs, and credits.
- Tests: not yet run red.
- Actual verification result: open.
- Residual risk: unbounded until implementation.

## AUDIT-002 — Provider contract and UI drift

- Severity: P0
- User impact: users and administrators receive false processor information and error handling can ignore the actual provider state.
- Evidence: `server/src/integrations.js` returns `naraRouter`; `AdminLegacyContentPanels.jsx` renders “Gemini API” and reads `integrationStatus.gemini`.
- Reproduction: provider-manifest contract test is introduced in the P0 plan.
- Root cause: provider identity is duplicated as hard-coded client and server property names.
- Changed files: not implemented.
- Fix: planned server-owned typed processor/provider manifest.
- Tests: not yet run red.
- Actual verification result: open.
- Residual risk: legal and product disclosure remain inaccurate until closure.

## AUDIT-003 — External AI consent drift

- Severity: P0
- User impact: a new user can transmit academic material externally without a durable, versioned consent record.
- Evidence: `defaultChatConfig.configuration.allowExternalAi` is true; no consent table records processor IDs, data classes, policy version, manifest version, source, and timestamp.
- Reproduction: consent-before-provider-invocation test is introduced in the P0 plan.
- Root cause: a mutable chat/session preference is being treated as processor consent.
- Changed files: not implemented.
- Fix: planned default-off versioned consent service tied to the active manifest.
- Tests: not yet run red.
- Actual verification result: open.
- Residual risk: external processing must be treated as a launch blocker.

## AUDIT-004 — Enter-to-send preference is ignored

- Severity: P0 correctness/accessibility
- User impact: users who disable Enter-to-send can submit incomplete content; keyboard behavior is unpredictable across preferences.
- Evidence: `Composer.jsx` submits any Enter without Shift when not composing and receives no `enterToSend` prop.
- Reproduction: pure keyboard truth table plus rendered desktop/mobile browser workflow.
- Root cause: Settings persists a preference that the composer never consumes.
- Changed files: not implemented.
- Fix: planned pure keyboard decision function and explicit preference wiring.
- Tests: not yet run red.
- Actual verification result: open.
- Residual risk: IME and mobile behavior require browser verification after unit coverage.

## AUDIT-005 — Message reactions are local-only

- Severity: P0 trust/data integrity
- User impact: a reaction can appear saved and disappear after reload; quality analytics cannot be tied safely to the generating configuration.
- Evidence: no message-reaction table or authenticated reaction endpoint exists.
- Reproduction: planned create/reload/reverse/remove/authorization API and browser tests.
- Root cause: reaction state was implemented as a presentation action without persistence.
- Changed files: not implemented.
- Fix: planned owner-scoped reaction record populated from canonical assistant-message metadata.
- Tests: not yet run red.
- Actual verification result: open.
- Residual risk: analytics must remain disabled until privacy-safe persistence exists.

## AUDIT-006 — Runtime DOM i18n walker

- Severity: P1 performance/quality
- User impact: streaming and frequent UI updates can retrigger full DOM scans and visible text mutation.
- Evidence: `I18nRuntime.jsx` uses `createTreeWalker`, `querySelectorAll`, and a subtree `MutationObserver` including character data.
- Reproduction: performance and missing-key/interpolation/pluralization tests are pending the localization phase.
- Root cause: incomplete migration from translated rendered text to component keys.
- Changed files: not implemented.
- Fix: remove legacy DOM translation only after keyed surface completion.
- Tests: open.
- Actual verification result: open.
- Residual risk: runtime cost remains during P0 work but may not be removed out of order.

## AUDIT-007 — CSS compatibility debt

- Severity: P1 maintainability/visual reliability
- User impact: unrelated selectors can override feature components and make theme/responsive fixes unpredictable.
- Evidence: 4,727 measured `!important` declarations in the 10,813-line compatibility stylesheet.
- Reproduction: existing CSS budget permits 4,730, so it detects growth rather than remediation.
- Root cause: repeated compatibility overrides accumulated after partial feature extraction.
- Changed files: not implemented.
- Fix: feature-owned layers and rendered deletion checkpoints after the landing freeze baseline.
- Tests: open.
- Actual verification result: open.
- Residual risk: no broad CSS deletion before visual baselines.

## AUDIT-008 — Settings theme behavior lacks rendered proof

- Severity: P1 UX/accessibility
- User impact: Settings may diverge from workspace theme or reduced-motion/high-contrast preferences.
- Evidence: source contains theme helpers, but no rendered matrix proves system/light/dark/high-contrast/reduced-motion behavior.
- Reproduction: pending browser matrix.
- Root cause: legacy modal styles and preference wiring require runtime inspection.
- Changed files: not implemented.
- Fix: stable Settings routes and shared semantic tokens in the Settings/Admin phase.
- Tests: open.
- Actual verification result: missing evidence.
- Residual risk: source inspection cannot close this finding.

## AUDIT-009 — Admin monolith and failure coupling

- Severity: P1 reliability/UX
- User impact: one unrelated endpoint can block the whole console; initial payload and recovery cost grow with every module.
- Evidence: `LegacyAdminWorkspace.jsx` loads seven unrelated resources in one `Promise.all` and switches local tabs without route-backed deep links.
- Reproduction: pending independent-route failure tests.
- Root cause: a tabbed page owns all remote state instead of route modules owning their own queries.
- Changed files: not implemented.
- Fix: route-backed lazy modules, independent boundaries, retry, pagination, filters, and last-updated state.
- Tests: open.
- Actual verification result: open.
- Residual risk: admin redesign cannot be treated as visual-only.

## AUDIT-010 — Binary admin authorization

- Severity: P0 security
- User impact: any administrator can reach sensitive operations that require narrower duties, recent MFA, break-glass reason, or a second approval.
- Evidence: most `/api/admin` routes use `requireAdmin` and the user model primarily exposes `role`.
- Reproduction: pending capability matrix and unauthorized-route integration tests.
- Root cause: authentication role and operational capability were modeled as one binary decision.
- Changed files: not implemented.
- Fix: server-side capability resolution and per-route middleware before modular Admin UI.
- Tests: open.
- Actual verification result: open.
- Residual risk: remains a launch blocker after P0 integrity and is resolved in the Settings/Admin subproject.

## Additional Security Surfaces

The following remain open for dedicated phases: provider secret storage, SSRF-safe egress, immutable configuration activation/rollback, MFA key separation and rotation, upload quarantine/malware/PII/prompt-injection states, high-risk approvals, content break-glass, retention execution, backup/restore, security scanners, and production configuration enforcement.

## Current Verdict

`NO-GO` for production-grade launch. This verdict reflects reproduced integrity, consent, provider-truth, authorization, and missing-evidence gaps. It does not negate the existing 109 server and 48 client tests; those suites validate a narrower legacy contract.
