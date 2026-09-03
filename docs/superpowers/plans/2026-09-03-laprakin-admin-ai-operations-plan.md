# Laprakin Admin AI Operations Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining mission gaps in the Admin AI model catalog, provider summaries, health telemetry, circuit controls, and maintenance state before the control-plane phase is declared complete.

**Architecture:** Every operational change remains server-authoritative, capability-checked, protected by recent MFA, reasoned, confirmed, and audited. Configuration changes create immutable child revisions; process-local circuit state is controlled through narrow runtime functions; maintenance state is stored in SQLite and consulted before AI transmission. The React modules consume only sanitized aggregate fields and keep the existing route-level isolation.

**Tech Stack:** Node.js, Express, Zod, SQLite, React, Vite, Node test runner, Playwright.

**Spec:** `C:/Users/Muba Sayang/.codex/attachments/1cc0339b-d390-4a24-9413-41841802db81/pasted-text-1.txt` sections 3.4, 3.8, 3.9, 15, and 20.

## Global Constraints

- Never return, log, audit, or display a complete provider credential.
- Every mutation requires its named server-side capability, CSRF, recent MFA, an eight-character reason, and exact typed confirmation for destructive or production-affecting operations.
- Manual critical capabilities stay `unverified` until a synthetic targeted canary passes; activation keeps enforcing verified evidence.
- Operational telemetry contains no prompt, output, file, or user-content fields.
- Landing files and landing computed appearance remain frozen.
- Indonesian and English Admin AI copy stays under `admin.ai.*`.

---

### Task 1: Add immutable model state and capability-test operations

**Files:**
- Modify: `server/src/ai-configuration-service.js`
- Modify: `server/src/admin-ai-routes.js`
- Modify: `server/test/admin-ai-control-plane-api.test.mjs`

**Interfaces:**
- Consumes: `createModelDraft`, provider adapters, immutable repository revisions, `ai.models.manage`.
- Produces: `PUT /api/admin/ai/models/:providerId/:modelId` and `POST /api/admin/ai/models/:providerId/:modelId/test`.

- [x] **Step 1: Write one failing API assertion for disabling a model into a child draft**

```js
const disabled = await owner.request('/admin/ai/models/managed/manual-model', {
  method: 'PUT', expectedStatus: 201,
  body: JSON.stringify({ revisionId, reason: 'Disable unused manual model', model: { enabled: false, state: 'disabled' } }),
});
assert.equal(disabled.revision.models.find((item) => item.modelId === 'manual-model').enabled, false);
```

- [x] **Step 2: Run `node --test server/test/admin-ai-control-plane-api.test.mjs` and verify the request fails with 404**
- [x] **Step 3: Implement the strict model patch route by cloning the selected revision through `createModelDraft`; reject missing models and audit provider/model IDs without content**
- [x] **Step 4: Re-run the focused API test and verify the disable assertion passes**
- [x] **Step 5: Write a failing API assertion that a targeted synthetic model test returns a child draft with `canary` evidence only for claimed critical capabilities**
- [x] **Step 6: Implement `testModelCapabilities({ revisionId, providerId, modelId, reason, auth })`; call the guarded adapter with Laprakin-owned synthetic input, set `vision`/`structuredOutput` evidence only after success, and audit the result**
- [x] **Step 7: Re-run the focused API test and verify both operations pass with secret-free responses**

### Task 2: Expose complete privacy-safe provider and route-health summaries

**Files:**
- Modify: `server/src/admin-ai-routes.js`
- Modify: `server/src/db.js`
- Modify: `server/src/ai.js`
- Modify: `server/test/admin-ai-control-plane-api.test.mjs`
- Modify: `server/test/ai-usage-privacy.test.mjs`

**Interfaces:**
- Consumes: revision providers/models/routes and `ai_usage_events` operational metadata.
- Produces: provider `modelCount`, `routesUsing`, `lastTestedAt`, `lastSuccessfulCall`, `lastFailure`; health `summary`, `routeHealth`, `modelAvailability`, and percentile/error fields.

- [x] **Step 1: Write failing API assertions for provider counts/routes/test time and literal p50/p95/success/fallback/error aggregates from hand-inserted usage rows**
- [x] **Step 2: Run the focused API test and verify those fields are absent**
- [x] **Step 3: Add `first_token_latency_ms INTEGER NOT NULL DEFAULT 0` with `ensureColumn`, capture the first streamed delta once, and persist it through `finishUsage`**
- [x] **Step 4: Update the privacy test to assert the new operational field exists while prompt/output columns remain absent; run it red then green**
- [x] **Step 5: Implement bounded in-process aggregation over at most 10,000 rows with a literal nearest-rank percentile function and error-code categories; return no identifiers beyond provider/model/route/revision metadata already authorized**
- [x] **Step 6: Re-run the focused API and privacy tests and verify exact aggregates**

### Task 3: Add audited circuit and maintenance controls

**Files:**
- Modify: `server/src/ai-configuration-schema.js`
- Modify: `server/src/ai.js`
- Modify: `server/src/ai-configuration-service.js`
- Modify: `server/src/admin-ai-routes.js`
- Modify: `server/test/admin-ai-control-plane-api.test.mjs`
- Modify: `server/test/ai-runtime-configuration.test.mjs`

**Interfaces:**
- Produces: `getAiCircuitSnapshot()`, `openAiCircuit({ providerId, modelId })`, `clearAiCircuit({ providerId, modelId })`, persistent singleton maintenance state, and Admin health mutation routes.
- Circuit endpoints: `POST /api/admin/ai/health/circuit/open` and `/clear`.
- Maintenance endpoint: `POST /api/admin/ai/health/maintenance`.

- [x] **Step 1: Write failing API assertions for typed-confirmed open circuit, test-before-clear, maintenance enable/clear, capability denial, audit rows, and sanitized GET health state**
- [x] **Step 2: Write a failing runtime test proving enabled maintenance blocks transmission with a clear 503 and disabled maintenance restores normal routing**
- [x] **Step 3: Run both focused tests and verify missing interfaces/routes cause the failures**
- [x] **Step 4: Add the SQLite singleton table with message, enabled flag, actor, reason, and timestamp; never store prompt/output data**
- [x] **Step 5: Export narrow circuit-state functions from `ai.js`; clearing must follow a successful guarded targeted canary in the service**
- [x] **Step 6: Implement the three secure mutation routes with exact confirmations, recent MFA, `ai.routing.manage`, and privacy-safe audits**
- [x] **Step 7: Consult maintenance state before provider transmission and return the configured plain-text message through the normal escaped client error path**
- [x] **Step 8: Re-run both focused tests and verify they pass**

### Task 4: Complete the Admin AI operational UI and rendered proof

**Files:**
- Modify: `client/src/lib/admin-ai.js`
- Modify: `client/src/pages/Admin/ai/ProvidersModule.jsx`
- Modify: `client/src/pages/Admin/ai/ModelsModule.jsx`
- Modify: `client/src/pages/Admin/ai/HealthModule.jsx`
- Modify: `client/src/pages/Admin/ai/shared.jsx`
- Modify: `client/src/i18n/id.json`
- Modify: `client/src/i18n/en.json`
- Modify: `client/src/styles/admin.css`
- Modify: `client/test/admin-ai-contract.test.mjs`
- Modify: `scripts/admin-ai-ui-check.mjs`

**Interfaces:**
- Consumes: Task 1-3 APIs through `createAdminAiClient`.
- Produces: provider operational summary rows, model enable/disable/test actions, health percentiles and error rates, circuit open/clear, and maintenance controls.

- [x] **Step 1: Add failing pure client boundary tests for model patch/test, circuit open/clear, and maintenance request method/path/body forwarding**
- [x] **Step 2: Run `node --test client/test/admin-ai-contract.test.mjs` and verify the new client methods are missing**
- [x] **Step 3: Implement the client methods and re-run the boundary tests green**
- [x] **Step 4: Add rendered browser assertions for provider summaries, model disable confirmation, capability-test confirmation, percentile labels, circuit controls, maintenance confirmation, focus return, Escape close, and no mobile overflow**
- [x] **Step 5: Run `npm run test:admin-ai-ui` and verify the new assertions fail before UI implementation**
- [x] **Step 6: Implement compact controls with `ConfirmationDialog`; keep credential fields password-only and clear mutation state after success**
- [x] **Step 7: Add focus trap, Escape close, inert background, and focus return to `ConfirmationDialog`; verify visible names in both locales**
- [x] **Step 8: Re-run browser proof at 1440x900 and 390x844, inspect screenshots, and verify the complete journey passes**
- [x] **Step 9: Run focused client/server tests, lint, typecheck, build, and `git diff --check`**
- [x] **Step 10: Commit as `feat: complete admin ai operations`**

## Self-review

- Spec coverage: Tasks 1-4 cover model discovery/state/evidence, provider row fields, health telemetry, disable-provider/route paths already present, circuit open/clear, rollback/kill switch already present, and maintenance messaging.
- No placeholders: every task names concrete files, interfaces, red failure, implementation boundary, and verification command.
- Type consistency: all revision mutations consume `revisionId`, produce `{ revision }`, and preserve the existing immutable-revision contract.
