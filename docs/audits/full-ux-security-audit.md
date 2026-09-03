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
- Evidence: the audited runtime used `createTreeWalker`, `querySelectorAll`, and a subtree `MutationObserver` including character data; the legacy translator contained 397 lines of post-render translation mappings and DOM mutation logic.
- Reproduction: the new no-DOM-mutation contract failed while `I18nRuntime.jsx` imported `translateUiText` and `legacy.js` existed. `npm run test:i18n-ui` initially failed because no browser harness existed, and the pluralization behavior test failed before the dictionary resolver was implemented.
- Root cause: incomplete migration from translated rendered text to component keys.
- Changed files: `client/src/i18n/I18nRuntime.jsx`, deleted `client/src/i18n/legacy.js`, `client/src/i18n/index.js`, `client/src/i18n/translate.js`, `client/src/i18n/en.json`, `client/src/i18n/id.json`, `client/test/i18n-contract.test.mjs`, `scripts/i18n-ui-check.mjs`, and `package.json`.
- Fix: React locale keys are now the only functional translation path. `I18nRuntime` supplies context and updates only document language/theme metadata. A pure dictionary resolver performs Indonesian fallback, interpolation, and `Intl.PluralRules` selection without touching rendered descendants.
- Tests: 18/18 focused i18n contracts and 70/70 complete client contracts passed. The isolated Playwright harness passed Auth, Workspace, Settings, and Notifications in English and Indonesian, verified a live language change plus persistence after reload, and checked desktop and 390px without horizontal overflow or unexpected browser errors.
- Actual verification result: resolved and verified on 2026-09-03. Source search found none of `translateUiText`, `MutationObserver`, `createTreeWalker`, `querySelectorAll`, `nodeValue`, or `setAttribute` in the i18n runtime/main entry; `legacy.js` is absent. Production build transformed 1,698 modules successfully, with the existing 654.85kB vendor-chunk advisory recorded separately. Landing-owned files remain unchanged from audited base `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de` at this checkpoint.
- Residual risk: every future functional string must be introduced as a locale key, and count-sensitive copy must provide plural variants. The source contract and browser harness guard the remediated routes, but do not replace ongoing review for newly added surfaces.

## AUDIT-007 — CSS compatibility debt

- Severity: P1 maintainability/visual reliability
- User impact: unrelated selectors can override feature components and make theme/responsive fixes unpredictable.
- Evidence: the audited compatibility sheet contained 4,727 `!important` declarations in 10,813 lines. Deletion checkpoint 1 reduced it to 3,060 declarations and 8,797 lines.
- Reproduction: the original CSS budget permitted 4,730, so it detected growth rather than remediation. A new source contract also proved the active client never renders the retired `.landing-page` root even though 749 selector branches remained for it.
- Root cause: repeated compatibility overrides accumulated after partial feature extraction.
- Changed files so far: `client/src/styles.css`, `client/test/css-budget.test.mjs`, `client/test/legacy-css-contract.test.mjs`, and the staged deletion plan.
- Fix in progress: checkpoint 1 removed 640 dead `.landing-page` rules/749 selector branches while preserving six non-Landing branches from mixed selector lists. The enforced budget is now 3,060. Feature-owned Admin and Workspace migrations remain.
- Tests: 3/3 focused CSS contracts and 80/80 complete client tests passed; lint, typecheck, production build, and the Landing freeze browser gate passed.
- Actual verification result: partial. The Landing post-CTA SHA-256 values remained exactly `eacb9d1ff881a30af9f09135895bf7e87f0bc341ca72583bee9efb46cfb17d3e` desktop and `3d4f3f7e987d9cafdf217d21e445e1eaa65f15703f6b8debbc7b4c93f655f05d` mobile. Zero pixels changed outside CTA masks or under alternate Workspace preferences. Production CSS fell from 646.81 kB (102.19 kB gzip) to 553.59 kB (88.37 kB gzip).
- Residual risk: 3,060 compatibility `!important` declarations and several live historical Workspace/Admin generations remain, so AUDIT-007 stays open.

## AUDIT-008 — Settings theme and motion behavior

- Severity: P1 UX/accessibility
- User impact: Settings may diverge from workspace theme or reduced-motion/high-contrast preferences.
- Evidence: source contained theme helpers but no rendered matrix; Workspace derived `data-motion` only from `prefs.reducedMotion`, ignoring the operating-system preference.
- Reproduction: `npm run test:settings-ui` was absent. The first browser run then failed because opening Settings left focus on the trigger behind the modal. A pure policy test also demonstrated the missing user/system motion resolution boundary.
- Root cause: theme styles had accumulated compatibility overrides without behavioral proof, the motion state modeled only the explicit user toggle, and the shared Modal primitive did not establish initial dialog focus.
- Changed files: `client/src/lib/motion-policy.js`, `client/src/lib/theme.js`, `client/src/pages/Workspace/LegacyWorkspaceView.jsx`, `client/src/components/Dialog.jsx`, `client/test/motion-policy.test.mjs`, `scripts/settings-ui-check.mjs`, and `package.json`.
- Fix: Workspace now combines the user toggle with live `prefers-reduced-motion`; Settings continues to consume Workspace semantic tokens. Modal focuses its first visible control and returns focus to the trigger. The isolated browser matrix validates the actual cascade rather than relying on source intent.
- Tests: 2/2 focused motion-policy tests, 72/72 complete client tests, and the Settings Playwright matrix passed; lint, typecheck, and production build also exited 0.
- Actual verification result: resolved and verified on 2026-09-03. System-dark, forced-light, forced-dark, and live system-light changes produced matching body, Workspace, Settings color-scheme, surface luminance, and text contrast. High-contrast tokens changed and secondary copy met the asserted 7:1 threshold. System and user reduced motion both suppressed Settings transitions; preferences survived reload; Escape/focus return and initial focus passed; 390px had no horizontal overflow or unexpected browser errors.
- Residual risk: this closes theme/motion correctness, not the wider Settings roadmap. Stable deep links/query state, server-backed preference sync with optimistic rollback, full 320px/400% reflow, and application-wide typography remediation remain open under later phases; the compatibility CSS debt remains AUDIT-007.

## AUDIT-009 — Admin monolith and failure coupling

- Severity: P1 reliability/UX
- User impact: one unrelated endpoint can block the whole console; initial payload and recovery cost grow with every module.
- Evidence: the original `LegacyAdminWorkspace.jsx` loaded seven unrelated resources in one `Promise.all`, required overview and CMS before rendering the shell, and referenced an unimported loading icon. The current production build emits a 6.99 kB legacy shell plus separate chunks for all 14 non-AI route modules.
- Reproduction: the first focused contract failed on the global batch/shell gate. Browser interception then reproduced an Audit data failure and a malformed Overview render; both now remain local while the shell and navigation stay usable.
- Root cause: a tabbed page owns all remote state instead of route modules owning their own queries.
- Changed files: `client/src/pages/Admin/LegacyAdminWorkspace.jsx`, `client/src/pages/Admin/AdminLegacyRoutes.jsx`, `client/src/pages/Admin/legacy/*`, the existing Admin domain panels, `client/src/styles/admin.css`, `server/src/admin-list-query.js`, `server/src/admin-audit.js`, the bounded Admin list routes in `server/src/index.js`, and their focused/API/browser tests.
- Fix: the shell now resolves every non-AI path through a lazy route map and a route-level render boundary. Every route owns loading, stale/error, retry, and freshness state. Users, credits, alerts, feedback, audit, appeals, broadcasts, and updates use bounded server queries; list search/status/cursor state survives in the URL, and `/admin/users/:id` performs an exact capability-protected lookup without adding content fields.
- Tests: 3/3 focused route contracts, 4/4 list-query contracts, 77/77 complete client tests, 181/181 complete server tests, direct Admin operations, lint, typecheck, production build, and the legacy Admin browser matrix passed.
- Actual verification result: resolved and verified on 2026-09-03. All 14 non-AI deep links requested only their route-owned resources; URL search/status survived reload; a seeded 31-user dataset passed next/previous navigation; selected-user deep links survived reload; 390px had no horizontal overflow; data and render failures recovered locally.
- Residual risk: list continuation uses bounded numeric cursors, so concurrent inserts can shift items between adjacent Admin pages; reloading page one reconciles live operational lists. This is a list-consistency tradeoff, not a return of whole-console failure coupling.

## AUDIT-010 — Binary admin authorization

- Severity: P0 security
- User impact: any administrator can reach sensitive operations that require narrower duties, recent MFA, break-glass reason, or a second approval.
- Evidence: the original routes relied primarily on `requireAdmin`; direct API tests now exercise the named capability boundary independently from client visibility.
- Reproduction: direct requests by users without the required capability receive `403 ADMIN_CAPABILITY_REQUIRED` without resource disclosure.
- Root cause: authentication role and operational capability were modeled as one binary decision.
- Changed files: `server/src/admin-capabilities.js`, `server/src/index.js`, `server/src/admin-ai-routes.js`, `server/test/admin-capabilities.test.mjs`, and `server/test/admin-authorization-api.test.mjs`.
- Fix: a stable server-side capability vocabulary and immutable role mappings protect sensitive Admin resources. AI mutations also require CSRF, recent MFA, reason, exact confirmation, and independent approval for production processor replacement.
- Tests: fresh focused AI/control-plane run, 59/59 passing on 2026-09-03; complete current server run, 181/181 passing after the bounded Admin query contracts were added.
- Actual verification result: resolved for the named capability routes and verified by direct API denial tests.
- Residual risk: browser affordances never substitute for server authorization; new Admin routes must declare a named server capability and join the route-isolation/browser inventory before release.

## AUDIT-011 — Static process-wide AI configuration

- Severity: P0 security/reliability
- User impact: provider credentials, models, fallbacks, and processor disclosure could drift, and unsafe changes lacked a tested atomic activation/rollback boundary.
- Evidence: the original runtime sourced a process-wide NaraRouter/Cloudflare configuration; it had no immutable drafts, capability evidence, active/LKG pointers, or secure Admin credential lifecycle.
- Reproduction: focused repository/service/API tests reproduce untested activation, expired evidence, credential replacement, provider outage, undisclosed fallback, and rollback paths.
- Root cause: provider integration, secret storage, routing, and runtime resolution were coupled to environment configuration.
- Changed files: `server/src/ai-*`, `server/src/admin-ai-routes.js`, `server/src/admin-capabilities.js`, `server/src/processor-manifest.js`, `server/src/external-ai-consent.js`, Admin AI client modules/locales/styles, focused tests, and operational runbooks.
- Fix: authenticated secret storage; guarded provider egress; adapter contracts; immutable provider/model/route revisions; synthetic testing; ten-minute evidence; atomic activation/LKG rollback; captured runtime snapshots; consent-aware fallback; metadata-only telemetry; circuit, maintenance, and emergency controls; route-isolated Admin AI UI.
- Tests: 59/59 focused AI/control-plane checks; 181/181 complete server checks; 77/77 complete client checks; deterministic local API E2E; Admin AI browser proof at desktop and 390px.
- Actual verification result: control-plane behavior is implemented and verified. Database assertions prove ciphertext-only envelope rows, immutable revision rows, atomic active/LKG pointers, revision-linked usage metadata, and absence of synthetic prompt/output plaintext in usage rows and audit payloads.
- Residual risk: live provider correctness and production Key Vault/managed-identity permissions require deployment-environment validation; application-wide release remains blocked by open findings below.

## Landing freeze gate

- Status: resolved and verified for Definition of Done items 20–22.
- Reproduction: although the original CTA rule declared weight 700, the later compatibility-layer `font: inherit` reset won. Both CTA buttons and spans computed to the unregistered `Plus Jakarta Sans` family at weight 400 on desktop and mobile.
- Changed files: `client/src/styles/tokens.css`, `client/src/styles/landing.css`, `client/test/landing-freeze-contract.test.mjs`, committed visual baselines, `scripts/landing-freeze-check.mjs`, and the root test command.
- Fix: Landing lime/mint and border aliases are now Landing-owned and no longer consume generic accent/text/line tokens. A narrow feature-owned compatibility bridge sets only the two approved CTA glyphs to the installed `Plus Jakarta Sans Variable` face at weight 700 and makes each child span inherit the same family/weight.
- Tests: 8/8 focused CSS/Landing contracts passed. The deterministic browser gate passed at 1440×1000 and 390×844 after `document.fonts.ready`.
- Actual verification result: both CTA buttons and spans compute to the variable family at weight 700; rectangles are unchanged; lime remains `#c2ff33`; mint remains `#45ffa2`; horizontal overflow is zero; pixel differences outside CTA rectangles are zero; dark/blue Workspace preferences and dark OS color scheme change zero Landing pixels.
- Evidence: committed baseline screenshots and metrics under `client/test/visual-baselines/`, generated after/diff artifacts under `output/playwright/landing-freeze/`, and `docs/design/LANDING_FREEZE_EVIDENCE.md`.
- Residual risk: the narrow CTA bridge remains in the compatibility cascade until AUDIT-007 removes the global font shorthand reset. The visual gate prevents that cleanup from silently changing Landing rendering.

## Additional Security Surfaces

The following remain open for dedicated phases: CSS compatibility debt, wider Settings routing/persistence/accessibility work, upload quarantine/malware/PII/prompt-injection states, content break-glass, retention execution, backup/restore proof, and the complete release workflow. Runtime DOM translation, Settings theme/motion behavior, and non-AI Admin route isolation are now verified; AI provider secret storage, guarded egress, immutable activation/rollback, capability enforcement, and production configuration contracts also have focused evidence.

## Current Verdict

`NO-GO` for the full production-grade mission. The AI control-plane slice, Landing freeze gate, AUDIT-006, AUDIT-008, and AUDIT-009 are verified, but AUDIT-007 and the remaining security/release surfaces above are not closed. Current fresh evidence includes 181/181 server tests, 80/80 client tests, 59/59 focused AI/control-plane checks, deterministic API E2E, production configuration validation, Admin operations, Admin AI, legacy Admin isolation, i18n, Settings, and Landing browser proof, dependency audit, and full-history secret scan; this evidence must not be generalized to the still-open application-wide requirements.

## Verification snapshot — 2026-09-03

- Audited base: `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`; legacy Admin implementation checkpoint before its closure documentation: `c0a8670`.
- Server: 181 passed, 0 failed, 0 skipped.
- Client: 80 passed, 0 failed, 0 skipped.
- I18n: 18 focused contracts passed; DOM translation source scan clean; real-browser Auth, Workspace, Settings, and Notifications passed in ID/EN at desktop and 390px with persistence after reload.
- Settings browser: system/light/dark, live OS theme changes, high contrast, system/user reduced motion, persistence, focus entry/return, Escape, and 390px reflow passed with no unexpected browser errors.
- Focused AI/control plane: 59 passed, 0 failed, 0 skipped.
- Migration: 2 passed, 0 failed; copy includes available WAL sidecar and refuses overwrite.
- API E2E: auth, profile, evidence, timeline, quality gate, template DOCX, restore, and verified password-change flow passed against a local synthetic provider; two metadata-only provider requests were observed.
- Admin AI browser: deep links, password-only credential handling, minimum 12px computed typography, standard font weights, ID/EN, retry, keyboard, dark theme, reduced motion, desktop, and 390px passed.
- Legacy Admin browser: 14 independent deep links, resource-request isolation, URL filter/reload state, selected-user deep link, seeded next/previous pagination, data/render failure recovery, desktop, and 390px passed.
- Landing freeze browser: hero/final CTA variable font and weight passed at 1440×1000 and 390×844; zero pixels changed outside CTA rectangles; dark/blue Workspace preferences changed zero Landing pixels.
- Production build: 1,717 modules transformed; 0 build failures; main CSS 553.59 kB/88.37 kB gzip after the first compatibility deletion checkpoint; separate legacy Admin route chunks and a 6.99kB shell; one advisory for the existing 654.85kB vendor chunk.
- Production configuration: 15 mandatory checks passed.
- Dependency audit: 0 vulnerabilities after upgrading Playwright to 1.55.1, the first release outside the detected browser-download certificate advisory range.
- Gitleaks 8.30.1: 229 commits and approximately 8.63MB scanned; 0 leaks. The downloaded Windows archive matched SHA-256 `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` before execution.
- Landing-owned source diff: only the approved token isolation and CTA glyph family/weight bridge; page markup, base Figma stylesheet, copy, assets, dimensions, color values, shadows, responsive rules, and motion remain unchanged.
- Non-failing runtime advisory: Node reports that built-in SQLite remains experimental. This is a platform warning, not a skipped or failed test.
- Rendered evidence: `output/playwright/landing-freeze/landing-desktop-after.png`, `landing-mobile-after.png`, their pixel diffs and preference variants; `output/playwright/admin-ai/providers-desktop.png`, `models-actions-desktop.png`, `health-operations-desktop.png`, `changes-mobile-dark.png`; `output/playwright/admin-legacy/cms-desktop.png`, `audit-mobile.png`; `output/playwright/i18n/workspace-en.png`, `settings-id.png`; and `output/playwright/settings/settings-light.png`, `settings-dark.png`, `settings-mobile-high-contrast.png`.
