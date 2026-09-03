# Laprakin Full UX and Security Audit

## Audit Method

This is a living evidence register. Findings are closed only by source inspection, a failing reproduction, a root-cause change, focused passing coverage, the relevant complete suite, and rendered/runtime evidence where the requirement is behavioral. Legacy green tests are supporting evidence, not automatic closure.

## AUDIT-001 — Stream fallback can duplicate a mutation

- Severity: P0
- User impact: duplicate messages, provider usage, credit operations, jobs, or documents after content-type rewriting, disconnect, reload, retry, or double click.
- Reproduction: the original stream client issued a second `POST` when content type was rewritten or an SSE terminal event was missing; concurrent identical requests had no durable uniqueness boundary.
- Root cause: transport parsing is coupled to mutation retry and the server has no canonical mutation ledger.
- Changed files: `client/src/api.js`, `client/src/lib/request-lifecycle.js`, `client/src/pages/Workspace/useLegacyWorkspaceController.js`, `server/src/db.js`, `server/src/mutation-requests.js`, `server/src/chat-message-mutation.js`, `server/src/index.js`, `server/src/services.js`, `server/src/ai.js`, and their focused tests.
- Fix: the client now parses the original response only, recovers through a read-only canonical snapshot, and retains the request identity across failure/reload. The server ledger serializes the mutation and uses the same request ID for messages, usage, jobs, and credit operations.
- Tests: `api-stream-contract`, `request-lifecycle`, `mutation-requests`, `chat-idempotency-api`, `chat-message-mutation`, and `chat-stream-api`; included in the fresh focused P0 results of 33/33 client and 13/13 server tests.
- Actual verification result: resolved and verified. One streamed request plus replay produced exactly one ledger row, one user message, one assistant message, one AI-usage event, and one credit operation; the provider completion count did not increase on replay. Complete suites passed at 59/59 client and 122/122 server tests.
- Residual risk: request identity is enforced for the remediated chat path; every future cost-bearing mutation must adopt the ledger before launch. Multi-instance contention still depends on the shared SQLite deployment topology and requires the later production architecture gate.

## AUDIT-002 — Provider contract and UI drift

- Severity: P0
- User impact: users and administrators receive false processor information and error handling can ignore the actual provider state.
- Reproduction: the server returned `naraRouter` while the Admin integration surface read `gemini` and displayed “Gemini API”.
- Root cause: provider identity is duplicated as hard-coded client and server property names.
- Changed files: `server/src/processor-manifest.js`, `server/src/integrations.js`, `server/src/index.js`, `client/src/pages/Admin/AdminLegacyContentPanels.jsx`, `client/src/pages/Admin/LegacyAdminWorkspace.jsx`, `client/src/pages/Workspace/Composer.jsx`, and locale resources.
- Fix: a server-owned, typed, versioned processor manifest now supplies the processor, provider, model, policy, region, retention, and disclosed data-class contract to user and Admin surfaces.
- Tests: `provider-contract`, `external-ai-consent`, `workspace-helpers`, `ai-consent-labels`, `ai-consent-ui-contract`, and `i18n-contract`; included in the fresh focused P0 results of 33/33 client and 13/13 server tests.
- Actual verification result: resolved and verified. Browser inspection showed NaraRouter consistently in the first-use gate and Settings; no Gemini label remained on the touched integration surface.
- Residual risk: the manifest currently describes the single implemented processor. Future provider additions must update the manifest and invalidate consent when its versioned disclosure changes.

## AUDIT-003 — External AI consent drift

- Severity: P0
- User impact: a new user can transmit academic material externally without a durable, versioned consent record.
- Reproduction: the authenticated client defaulted `allowExternalAi` to true and had no processor-, manifest-, or policy-versioned consent record.
- Root cause: a mutable chat/session preference is being treated as processor consent.
- Changed files: `server/src/external-ai-consent.js`, `server/src/db.js`, `server/src/index.js`, `server/src/ai.js`, `client/src/lib/workspace-helpers.js`, `client/src/lib/ai-consent-labels.js`, `client/src/pages/Workspace/Composer.jsx`, `client/src/pages/Workspace/SettingsModal.jsx`, `client/src/pages/Workspace/useLegacyWorkspaceController.js`, and their focused tests.
- Fix: external AI is default-off and server-enforced before provider invocation, credit use, or message persistence. Consent records the processor/data classes, manifest version, policy version, source surface, and grant/revoke timestamps; stale consent is inactive.
- Tests: `external-ai-consent`, `chat-stream-api`, `workspace-helpers`, `ai-consent-labels`, and `ai-consent-ui-contract`; included in the fresh focused P0 results of 33/33 client and 13/13 server tests.
- Actual verification result: resolved and verified. The API returned `412 AI_CONSENT_REQUIRED`, with zero provider calls and zero persisted messages before consent. Browser checks proved first-use grant, immediate revoke, and immediate re-gating without reload.
- Residual risk: this is explicit application consent, not a substitute for the final legal-policy review. Revocation prevents new sends; downstream provider deletion obligations remain part of the later privacy/retention phase.

## AUDIT-004 — Enter-to-send preference is ignored

- Severity: P0 correctness/accessibility
- User impact: users who disable Enter-to-send can submit incomplete content; keyboard behavior is unpredictable across preferences.
- Reproduction: `Composer.jsx` submitted every Enter press that was not Shift+Enter or an IME composition and never consumed `prefs.enterToSend`.
- Root cause: Settings persists a preference that the composer never consumes.
- Changed files: `client/src/lib/composer-keyboard.js`, `client/src/pages/Workspace/Composer.jsx`, `client/src/pages/Workspace/ChatSurface.jsx`, `client/src/pages/Workspace/LegacyWorkspaceView.jsx`, and `scripts/ui-workflow-check.py`.
- Fix: a pure keyboard decision function now handles Enter, Shift+Enter, Ctrl/Cmd+Enter, composition state, and the persisted preference; the visible hint follows the active mode.
- Tests: `composer-keyboard` plus the fresh focused client P0 run (33/33) and complete client suite (59/59).
- Actual verification result: resolved and verified. Browser checks at desktop and 390 px proved Enter-to-send on, Shift+Enter newline, Enter-to-send off, Ctrl+Enter submit, composition suppression, and no horizontal overflow.
- Residual risk: rendered checks used the interactive browser because the standalone Python Playwright package is not installed in the current workstation interpreter. The script compiles and is updated, but CI must install and execute it before release.

## AUDIT-005 — Message reactions are local-only

- Severity: P0 trust/data integrity
- User impact: a reaction can appear saved and disappear after reload; quality analytics cannot be tied safely to the generating configuration.
- Reproduction: reactions changed component-local state only; reload discarded them and the server had no owner-scoped record.
- Root cause: reaction state was implemented as a presentation action without persistence.
- Changed files: `server/src/message-reactions.js`, `server/src/db.js`, `server/src/index.js`, `client/src/lib/chat-message-actions.js`, `client/src/pages/Workspace/ChatComponents.jsx`, `client/src/pages/Workspace/useLegacyWorkspaceController.js`, and their focused tests.
- Fix: authenticated `PUT`/`DELETE` endpoints persist one reversible owner-scoped reaction per assistant message. Immutable request/provider/model/configuration/prompt-template metadata comes from the canonical message and mutation ledger, not browser input; Admin analytics exposes aggregates only.
- Tests: `message-reactions-api` and `chat-message-actions`; included in the fresh focused P0 results of 33/33 client and 13/13 server tests.
- Actual verification result: resolved and verified. API coverage proved create, reload, reverse, remove, cross-user 404, metadata integrity, and content-free aggregate analytics. Browser checks proved selection, persistence across reload, reversal, and removal across reload.
- Residual risk: enumerated reasons are implemented but the current UI captures the reaction only. Any future free-text feedback requires a separate privacy and moderation design.

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
- Evidence: the original routes relied primarily on `requireAdmin`; direct API tests now exercise the named capability boundary independently from client visibility.
- Reproduction: direct requests by users without the required capability receive `403 ADMIN_CAPABILITY_REQUIRED` without resource disclosure.
- Root cause: authentication role and operational capability were modeled as one binary decision.
- Changed files: `server/src/admin-capabilities.js`, `server/src/index.js`, `server/src/admin-ai-routes.js`, `server/test/admin-capabilities.test.mjs`, and `server/test/admin-authorization-api.test.mjs`.
- Fix: a stable server-side capability vocabulary and immutable role mappings protect sensitive Admin resources. AI mutations also require CSRF, recent MFA, reason, exact confirmation, and independent approval for production processor replacement.
- Tests: fresh focused AI/control-plane run, 59/59 passing on 2026-09-03; complete current server run, 179/179 passing after the deterministic E2E/migration harness tests were added.
- Actual verification result: resolved for the named capability routes and verified by direct API denial tests.
- Residual risk: remaining legacy Admin routes must be mapped and reviewed as their route-backed modules are extracted; browser affordances never substitute for server authorization.

## AUDIT-011 — Static process-wide AI configuration

- Severity: P0 security/reliability
- User impact: provider credentials, models, fallbacks, and processor disclosure could drift, and unsafe changes lacked a tested atomic activation/rollback boundary.
- Evidence: the original runtime sourced a process-wide NaraRouter/Cloudflare configuration; it had no immutable drafts, capability evidence, active/LKG pointers, or secure Admin credential lifecycle.
- Reproduction: focused repository/service/API tests reproduce untested activation, expired evidence, credential replacement, provider outage, undisclosed fallback, and rollback paths.
- Root cause: provider integration, secret storage, routing, and runtime resolution were coupled to environment configuration.
- Changed files: `server/src/ai-*`, `server/src/admin-ai-routes.js`, `server/src/admin-capabilities.js`, `server/src/processor-manifest.js`, `server/src/external-ai-consent.js`, Admin AI client modules/locales/styles, focused tests, and operational runbooks.
- Fix: authenticated secret storage; guarded provider egress; adapter contracts; immutable provider/model/route revisions; synthetic testing; ten-minute evidence; atomic activation/LKG rollback; captured runtime snapshots; consent-aware fallback; metadata-only telemetry; circuit, maintenance, and emergency controls; route-isolated Admin AI UI.
- Tests: 59/59 focused AI/control-plane checks; 179/179 complete server checks; 69/69 complete client checks; deterministic local API E2E; Admin AI browser proof at desktop and 390px.
- Actual verification result: control-plane behavior is implemented and verified. Database assertions prove ciphertext-only envelope rows, immutable revision rows, atomic active/LKG pointers, revision-linked usage metadata, and absence of synthetic prompt/output plaintext in usage rows and audit payloads.
- Residual risk: live provider correctness and production Key Vault/managed-identity permissions require deployment-environment validation; application-wide release remains blocked by open findings below.

## Additional Security Surfaces

The following remain open for dedicated phases: removal of the DOM translation walker, CSS compatibility debt, complete Settings/theme browser evidence, route isolation for the non-AI Admin console, upload quarantine/malware/PII/prompt-injection states, content break-glass, retention execution, backup/restore proof, and the complete release workflow. AI provider secret storage, guarded egress, immutable activation/rollback, capability enforcement, and production configuration contracts now have focused evidence.

## Current Verdict

`NO-GO` for the full production-grade mission. The AI control-plane slice is verified, but AUDIT-006 through AUDIT-009 and the remaining security/release surfaces above are not closed. Current fresh evidence includes 179/179 server tests, 69/69 client tests, 59/59 focused AI/control-plane checks, deterministic API E2E, production configuration validation, Admin operations, Admin AI browser proof, dependency audit, and full-history secret scan; this evidence must not be generalized to the still-open application-wide requirements.

## Verification snapshot — 2026-09-03

- Audited base: `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`; verification branch checkpoint before this documentation: `bb8ef7f`.
- Server: 179 passed, 0 failed, 0 skipped.
- Client: 69 passed, 0 failed, 0 skipped.
- Focused AI/control plane: 59 passed, 0 failed, 0 skipped.
- Migration: 2 passed, 0 failed; copy includes available WAL sidecar and refuses overwrite.
- API E2E: auth, profile, evidence, timeline, quality gate, template DOCX, restore, and verified password-change flow passed against a local synthetic provider; two metadata-only provider requests were observed.
- Admin AI browser: deep links, password-only credential handling, minimum 12px computed typography, standard font weights, ID/EN, retry, keyboard, dark theme, reduced motion, desktop, and 390px passed.
- Production build: 1,698 modules transformed; 0 build failures; one advisory for the existing 654.85kB vendor chunk.
- Production configuration: 15 mandatory checks passed.
- Dependency audit: 0 vulnerabilities.
- Gitleaks 8.30.1: 229 commits and approximately 8.63MB scanned; 0 leaks. The downloaded Windows archive matched SHA-256 `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` before execution.
- Landing-owned files: no diff from the audited base at this checkpoint.
- Non-failing runtime advisory: Node reports that built-in SQLite remains experimental. This is a platform warning, not a skipped or failed test.
- Rendered evidence: `output/playwright/admin-ai/providers-desktop.png`, `models-actions-desktop.png`, `health-operations-desktop.png`, and `changes-mobile-dark.png`.
