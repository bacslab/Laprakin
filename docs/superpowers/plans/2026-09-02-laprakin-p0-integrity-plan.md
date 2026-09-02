# Laprakin P0 Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every chat mutation canonical and idempotent, require truthful processor consent, persist message reactions, honor composer keyboard preferences, and remove provider-contract drift before visual redesign begins.

**Architecture:** A durable mutation ledger wraps cost-bearing chat actions and links all downstream records through one request ID. The client owns request identity across retry/reload, reads fallback responses without replaying POSTs, and queries a canonical snapshot after interrupted streams. Processor disclosure and consent derive from one server manifest, while focused client/server modules keep keyboard and reaction behavior independently testable.

**Tech Stack:** Node.js 22, Express 4, built-in SQLite, Zod, React 18, native Fetch/SSE, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-02-laprakin-claude-grade-v2-design.md`

## Global Constraints

- Audited base is `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de` on `remediation/claude-grade-v2`.
- Do not modify frozen landing files or landing rendering in this plan.
- Preserve account, chat, project, document, upload, generation, revision, quiz, export, billing, credit, referral, notification, feedback, appeal, and admin behavior.
- Every implementation task uses red → green → regression verification and ends in a logical commit.
- Never print request content, raw conversation content, credentials, tokens, or secrets in tests, logs, audit metadata, or command output.
- One user action creates at most one canonical cost-bearing mutation; every retry uses the original key.
- No new `!important`, fake persistence state, fake provider, or toast-only mutation is permitted.
- Existing legacy server and client suites remain required but cannot substitute for focused P0 tests.

---

### Task 1: Record the V2 baseline and P0 reproductions

**Files:**
- Create: `docs/audits/re-audit-baseline.md`
- Create: `docs/audits/full-ux-security-audit.md`
- Test: `client/test/api-stream-contract.test.mjs`
- Test: `client/test/composer-keyboard.test.mjs`
- Test: `server/test/provider-contract.test.mjs`

**Interfaces:**
- Consumes: current `apiStream`, `Composer`, provider integration response, and audited command output.
- Produces: executable failing contracts and a baseline document used by every later phase.

- [x] **Step 1: Write the audit baseline**

Record the base SHA, branch, OS/Node/npm versions, initial server/client counts, the cold-start timing observation, build warning, route inventory, 4,727 legacy `!important` count, and exact P0 source evidence. Mark each definition-of-done item as `contradicted`, `missing evidence`, or `not yet tested`; do not mark future work complete.

- [x] **Step 2: Write the stream fallback behavior contract**

```js
test('non-SSE mutation response is parsed without a second fetch', async () => {
  const calls = [];
  const payload = { session: { id: 's1' }, messages: [] };
  const result = await performStreamRequest('/chat/sessions/s1/messages', {
    method: 'POST',
    requestId: 'req-contract-1234',
    body: { content: 'Satu aksi' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(result, payload);
});
```

- [x] **Step 3: Write composer and provider manifest behavior contracts**

Import the wished-for `shouldSubmitComposerKey` helper and assert the complete keyboard truth table from Task 6. Import `buildProcessorManifest` and assert a NaraRouter configuration produces `providers: [{ id: 'nararouter', displayName: 'NaraRouter', ... }]` without a `gemini` property. Later rendered tests verify Admin consumes this manifest instead of branching on provider names.

- [x] **Step 4: Run the new tests and capture the red evidence**

Run:

```text
node --test client/test/api-stream-contract.test.mjs client/test/composer-keyboard.test.mjs server/test/provider-contract.test.mjs
```

Expected: missing-module or missing-export failures prove the single-fetch lifecycle, keyboard helper, and provider manifest do not yet exist.

- [x] **Step 5: Commit the baseline and red tests**

```text
git add docs/audits client/test/api-stream-contract.test.mjs client/test/composer-keyboard.test.mjs server/test/provider-contract.test.mjs
git commit -m "test: capture claude-grade p0 baseline"
```

### Task 2: Add durable mutation-request storage

**Files:**
- Create: `server/src/mutation-requests.js`
- Test: `server/test/mutation-requests.test.mjs`
- Modify: `server/src/db.js`

**Interfaces:**
- Produces: `normalizeRequestId(value)`, `hashMutationInput(value)`, `beginMutation(input)`, `completeMutation(input)`, `failMutation(input)`, and `getMutationSnapshot(input)`.
- `beginMutation` returns `{ disposition: 'started' | 'replay' | 'in_progress', mutation }` and throws `IDEMPOTENCY_KEY_REUSED` for a hash mismatch.

- [ ] **Step 1: Write failing ledger tests**

```js
test('one owner, operation, and key has one canonical row', () => {
  const first = beginMutation({ ownerUserId: 'u1', operation: 'chat.message', requestId: 'req-12345678', input: { content: 'A' } });
  const replay = beginMutation({ ownerUserId: 'u1', operation: 'chat.message', requestId: 'req-12345678', input: { content: 'A' } });
  assert.equal(first.disposition, 'started');
  assert.equal(replay.disposition, 'in_progress');
});

test('a completed mutation returns its canonical result', () => {
  completeMutation({ ownerUserId: 'u1', operation: 'chat.message', requestId: 'req-12345678', statusCode: 200, response: { session: { id: 's1' } } });
  const replay = beginMutation({ ownerUserId: 'u1', operation: 'chat.message', requestId: 'req-12345678', input: { content: 'A' } });
  assert.equal(replay.disposition, 'replay');
  assert.deepEqual(replay.mutation.response, { session: { id: 's1' } });
});
```

- [ ] **Step 2: Run the focused test and verify missing storage fails**

Run: `node --test server/test/mutation-requests.test.mjs`

Expected: module-not-found or missing-export failure.

- [ ] **Step 3: Add the schema and indexes**

Create `mutation_requests` with a unique `(owner_user_id, operation, request_id)` index, request hash, state, resource linkage, configuration/provider/model/template revisions, canonical status/response, timestamps, and a foreign key to users. Add `request_id` columns and indexes to `chat_messages`, `ai_usage_events`, and `jobs` through the repository's forward-safe migration pattern.

- [ ] **Step 4: Implement atomic ledger transitions**

Use SQLite immediate transactions for acquisition and completion. Serialize only privacy-safe canonical API payloads; reject malformed stored JSON as a terminal server error instead of silently starting a second mutation.

- [ ] **Step 5: Run focused and migration tests**

Run:

```text
node --test server/test/mutation-requests.test.mjs
npm test
```

Expected: ledger tests pass; legacy server suite has zero failures.

- [ ] **Step 6: Commit the mutation ledger**

```text
git add server/src/db.js server/src/mutation-requests.js server/test/mutation-requests.test.mjs
git commit -m "feat: add canonical mutation ledger"
```

### Task 3: Make the chat endpoint idempotent end to end

**Files:**
- Create: `server/src/chat-message-mutation.js`
- Test: `server/test/chat-idempotency-api.test.mjs`
- Modify: `server/src/index.js`
- Modify: `server/src/services.js`
- Modify: `server/src/ai.js`

**Interfaces:**
- Consumes: mutation ledger from Task 2.
- Produces: `executeChatMessageMutation({ requestId, session, user, input, signal, onDelta })` and `GET /api/mutations/:requestId`.
- Chat schema requires `requestId` matching `/^[a-zA-Z0-9._:-]{12,120}$/` and the header must equal the body value.

- [ ] **Step 1: Write API reproductions for replay and concurrency**

Use a counted fake provider and assert:

```js
const [first, second] = await Promise.all([
  sendMessage({ requestId: key, content: 'Satu aksi' }),
  sendMessage({ requestId: key, content: 'Satu aksi' }),
]);
assert.equal(providerCalls, 1);
assert.equal(countMessages({ sessionId, requestId: key, role: 'user' }), 1);
assert.equal(countMessages({ sessionId, requestId: key, role: 'assistant' }), 1);
assert.equal(countUsage({ requestId: key }), 1);
assert.equal(countCreditOperations({ requestId: key }), 1);
assert.deepEqual(canonicalPayload(first, second), true);
```

Cover response loss after commit by closing the first response and replaying the same key. Cover different content with the same key returning `409 IDEMPOTENCY_KEY_REUSED`.

- [ ] **Step 2: Run the focused API test and verify duplicate behavior**

Run: `node --test server/test/chat-idempotency-api.test.mjs`

Expected: the current endpoint either rejects the request ID or calls the provider/persists more than once.

- [ ] **Step 3: Extract the mutation executor**

Move the existing chat orchestration behind `executeChatMessageMutation`. Acquire the ledger before credit reservation. Stamp the request ID on user/assistant messages, usage, jobs, and credit operations. Complete the ledger only with the same canonical payload returned to clients.

- [ ] **Step 4: Add the canonical snapshot endpoint**

Return only the authenticated owner's mutation. Map states to `202 processing`, `200 completed`, `409 retryable_failed`, `422 terminal_failed`, or `410 canceled`. Never return raw prompts, credentials, provider errors, or another user's record.

- [ ] **Step 5: Propagate cancellation**

Pass the composed abort signal through the chat executor and provider fetch. If abort occurs before canonical commit, set an explicit retryable/canceled state according to the abort reason and refund an unconsumed reservation. If commit already occurred, return the completed snapshot on replay.

- [ ] **Step 6: Run the complete chat integrity matrix**

Run:

```text
node --test server/test/chat-idempotency-api.test.mjs server/test/chat-stream-api.test.mjs server/test/chat-stream.test.mjs
npm test
```

Expected: one provider call and one canonical exchange for double click, concurrent requests, response loss, reload replay, and manual retry.

- [ ] **Step 7: Commit server chat idempotency**

```text
git add server/src/chat-message-mutation.js server/src/index.js server/src/services.js server/src/ai.js server/test/chat-idempotency-api.test.mjs
git commit -m "fix: make chat mutations idempotent"
```

### Task 4: Parse the original stream response and recover canonically

**Files:**
- Create: `client/src/lib/request-lifecycle.js`
- Test: `client/test/request-lifecycle.test.mjs`
- Modify: `client/src/api.js`
- Modify: `client/src/lib/read-sse-stream.js`
- Modify: `client/src/pages/Workspace/useLegacyWorkspaceController.js`
- Test: `client/test/api-stream-contract.test.mjs`

**Interfaces:**
- Produces: `composeRequestSignal({ signal, timeoutMs })`, `parseOriginalResponse(response)`, `classifyRequestFailure(error)`, and `loadCanonicalMutation(requestId, options)`.
- `apiStream` accepts `requestId`, `timeoutMs`, `signal`, `onDelta`, and `onState` and performs exactly one mutation fetch.

- [ ] **Step 1: Write failing fetch-count tests**

Inject a fetch implementation and cover non-SSE JSON, proxied JSON with a wrong content type, disconnect before first delta, disconnect after a delta, and completed response whose final frame is lost. Assert the POST fetch count remains one in every case.

- [ ] **Step 2: Run the focused client tests**

Run:

```text
node --test client/test/request-lifecycle.test.mjs client/test/api-stream-contract.test.mjs client/test/read-sse-stream.test.mjs
```

Expected: current fallback tests fail because `apiStream` invokes `api()`.

- [ ] **Step 3: Implement original-response parsing**

For non-SSE responses, read the original body once, attempting JSON from either content type or parseable text. For incomplete SSE, classify interruption and query the read-only canonical snapshot endpoint. Do not infer completion from the presence of any delta.

- [ ] **Step 4: Add timeout and caller cancellation**

Compose the caller signal with `AbortSignal.timeout(timeoutMs)`. Preserve the first abort reason and surface distinct `REQUEST_TIMEOUT`, `REQUEST_CANCELED`, `STREAM_INTERRUPTED`, and `CANONICAL_COMPLETED` states.

- [ ] **Step 5: Persist request identity with the draft**

Generate the request ID once before optimistic messages are added. Keep it through failure/reload/manual retry and clear it only after canonical acknowledgement. Use the same ID in header and body.

- [ ] **Step 6: Verify the red-green regression cycle**

Run the focused tests green, temporarily restore the old `return api(...)` fallback, prove the fetch-count test fails, restore the fix, and rerun green.

- [ ] **Step 7: Commit client mutation lifecycle**

```text
git add client/src/api.js client/src/lib/request-lifecycle.js client/src/lib/read-sse-stream.js client/src/pages/Workspace/useLegacyWorkspaceController.js client/test/request-lifecycle.test.mjs client/test/api-stream-contract.test.mjs client/test/read-sse-stream.test.mjs
git commit -m "fix: recover chat streams without replaying posts"
```

### Task 5: Establish one processor manifest and explicit consent

**Files:**
- Create: `server/src/processor-manifest.js`
- Create: `server/src/external-ai-consent.js`
- Test: `server/test/external-ai-consent.test.mjs`
- Test: `server/test/provider-contract.test.mjs`
- Modify: `server/src/db.js`
- Modify: `server/src/index.js`
- Modify: `server/src/integrations.js`
- Modify: `client/src/lib/workspace-helpers.js`
- Modify: `client/src/pages/Workspace/SettingsModal.jsx`
- Modify: `client/src/pages/Workspace/Composer.jsx`
- Modify: `client/src/pages/Admin/AdminLegacyContentPanels.jsx`
- Modify: `client/src/pages/Admin/LegacyAdminWorkspace.jsx`
- Modify: `client/src/i18n/id.json`
- Modify: `client/src/i18n/en.json`

**Interfaces:**
- Produces: `buildProcessorManifest(config)`, `requireExternalAiConsent(input)`, `recordExternalAiConsent(input)`, and `revokeExternalAiConsent(input)`.
- Public API: `GET /api/ai/processor-manifest`, `GET /api/privacy/ai-consent`, `POST /api/privacy/ai-consent`, and `DELETE /api/privacy/ai-consent`.

- [ ] **Step 1: Write manifest and consent tests**

Assert the active NaraRouter adapter appears as a provider record with a display name and stable ID; no generic UI contract exposes a `gemini` field. Assert a user without a record is denied before provider invocation. Assert consent stores user ID, provider IDs, data classes, policy/manifest versions, source surface, and timestamp. Assert a materially changed manifest invalidates the old record.

- [ ] **Step 2: Run focused tests and capture red evidence**

Run:

```text
node --test server/test/external-ai-consent.test.mjs server/test/provider-contract.test.mjs
```

Expected: no consent table/service and mismatched provider contract.

- [ ] **Step 3: Add consent schema and server services**

Create versioned consent rows rather than overloading session configuration. Enforce consent in the server immediately before every external AI transmission path. Keep local fallback available where business rules currently permit it.

- [ ] **Step 4: Replace generic provider branches**

Return arrays of typed provider health records from `verifyProductionIntegrations`. Render `provider.displayName`, health, models, and last-checked state in Admin. Google OIDC and Azure Blob remain separate integration kinds and are not mislabeled as AI providers.

- [ ] **Step 5: Default client configuration to false**

Change `defaultChatConfig.configuration.allowExternalAi` to `false`. Settings and composer read the consent API and show the active processor/data classes before recording first-use consent. Revocation updates persisted server state and prevents subsequent provider calls.

- [ ] **Step 6: Run server/client contract verification**

Run:

```text
node --test server/test/external-ai-consent.test.mjs server/test/provider-contract.test.mjs client/test/i18n-contract.test.mjs client/test/workspace-helpers.test.mjs
npm test
```

Expected: consent and provider contracts pass with legacy behavior preserved.

- [ ] **Step 7: Commit manifest and consent**

```text
git add server/src/processor-manifest.js server/src/external-ai-consent.js server/src/db.js server/src/index.js server/src/integrations.js server/test/external-ai-consent.test.mjs server/test/provider-contract.test.mjs client/src/lib/workspace-helpers.js client/src/pages/Workspace/SettingsModal.jsx client/src/pages/Workspace/Composer.jsx client/src/pages/Admin/AdminLegacyContentPanels.jsx client/src/pages/Admin/LegacyAdminWorkspace.jsx client/src/i18n/id.json client/src/i18n/en.json
git commit -m "fix: require truthful external ai consent"
```

### Task 6: Honor the Enter-to-send preference

**Files:**
- Create: `client/src/lib/composer-keyboard.js`
- Test: `client/test/composer-keyboard.test.mjs`
- Modify: `client/src/pages/Workspace/Composer.jsx`
- Modify: `client/src/pages/Workspace/LegacyWorkspaceView.jsx`
- Modify: `client/src/pages/Workspace/useLegacyWorkspaceController.js`
- Test: `scripts/ui-workflow-check.py`

**Interfaces:**
- Produces: `shouldSubmitComposerKey({ key, shiftKey, ctrlKey, metaKey, isComposing, enterToSend })`.
- Composer receives `enterToSend` as an explicit boolean prop.

- [ ] **Step 1: Complete the keyboard truth table test**

```js
assert.equal(shouldSubmitComposerKey({ key: 'Enter', enterToSend: true }), true);
assert.equal(shouldSubmitComposerKey({ key: 'Enter', shiftKey: true, enterToSend: true }), false);
assert.equal(shouldSubmitComposerKey({ key: 'Enter', enterToSend: false }), false);
assert.equal(shouldSubmitComposerKey({ key: 'Enter', ctrlKey: true, enterToSend: false }), true);
assert.equal(shouldSubmitComposerKey({ key: 'Enter', metaKey: true, enterToSend: false }), true);
assert.equal(shouldSubmitComposerKey({ key: 'Enter', ctrlKey: true, isComposing: true, enterToSend: false }), false);
```

- [ ] **Step 2: Run the focused test red**

Run: `node --test client/test/composer-keyboard.test.mjs`

Expected: missing helper and current hard-coded behavior fail.

- [ ] **Step 3: Implement the pure helper and wire the preference**

Use both React's composition state and `nativeEvent.isComposing`. Call `requestSubmit()` only when the pure helper returns true. The send button remains independent of the keyboard preference.

- [ ] **Step 4: Add rendered browser coverage**

In the existing workflow browser script, test both modes, Shift+Enter, Ctrl+Enter, and composition behavior at desktop and 390 px mobile width.

- [ ] **Step 5: Run focused, browser, and client tests**

Run:

```text
node --test client/test/composer-keyboard.test.mjs
node --test "client/test/*.test.mjs"
npm run test:e2e
```

Expected: keyboard matrix and actual composer workflow pass.

- [ ] **Step 6: Commit composer preference behavior**

```text
git add client/src/lib/composer-keyboard.js client/src/pages/Workspace/Composer.jsx client/src/pages/Workspace/LegacyWorkspaceView.jsx client/src/pages/Workspace/useLegacyWorkspaceController.js client/test/composer-keyboard.test.mjs scripts/ui-workflow-check.py
git commit -m "fix: honor composer send preference"
```

### Task 7: Persist reversible message reactions

**Files:**
- Create: `server/src/message-reactions.js`
- Test: `server/test/message-reactions-api.test.mjs`
- Modify: `server/src/db.js`
- Modify: `server/src/index.js`
- Modify: `client/src/lib/chat-message-actions.js`
- Modify: `client/src/pages/Workspace/ChatComponents.jsx`
- Modify: `client/src/pages/Workspace/useLegacyWorkspaceController.js`
- Test: `client/test/chat-message-actions.test.mjs`

**Interfaces:**
- Produces: `setMessageReaction(input)`, `removeMessageReaction(input)`, `getMessageReactions(input)`, `PUT /api/chat/messages/:messageId/reaction`, and `DELETE /api/chat/messages/:messageId/reaction`.
- Reaction value is `like` or `dislike`; reason is an optional enumerated code.

- [ ] **Step 1: Write failing persistence and privacy tests**

Assert create, reload, switch, remove, and reverse behavior. Assert another user receives 404. Assert the stored row contains message/request/provider/model-config/prompt-template revisions. Assert normal admin analytics return counts without message content.

- [ ] **Step 2: Run focused reaction tests red**

Run:

```text
node --test server/test/message-reactions-api.test.mjs client/test/chat-message-actions.test.mjs
```

Expected: no server reaction endpoint and client-local behavior fail.

- [ ] **Step 3: Implement server persistence**

Use a unique `(owner_user_id, message_id)` row. Copy immutable request/provider/model/template metadata from the canonical assistant message rather than trusting browser input.

- [ ] **Step 4: Wire optimistic UI with rollback**

Update the reaction immediately, call the API, and restore the prior value on failure. Announce saved state only after the server response. Do not send raw conversation content with the reaction request.

- [ ] **Step 5: Verify reload and reversal**

Run focused tests, then use the browser workflow to react, reload, verify persistence, reverse, reload, and verify removal/replacement.

- [ ] **Step 6: Commit reaction persistence**

```text
git add server/src/message-reactions.js server/src/db.js server/src/index.js server/test/message-reactions-api.test.mjs client/src/lib/chat-message-actions.js client/src/pages/Workspace/ChatComponents.jsx client/src/pages/Workspace/useLegacyWorkspaceController.js client/test/chat-message-actions.test.mjs
git commit -m "feat: persist message reactions"
```

### Task 8: Close the P0 phase with evidence

**Files:**
- Modify: `docs/audits/re-audit-baseline.md`
- Modify: `docs/audits/full-ux-security-audit.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all P0 tests and commit history.
- Produces: the phase checkpoint required before AI control-plane implementation.

- [ ] **Step 1: Re-run every focused P0 test from a fresh process**

Run:

```text
node --test client/test/api-stream-contract.test.mjs client/test/request-lifecycle.test.mjs client/test/composer-keyboard.test.mjs client/test/chat-message-actions.test.mjs client/test/i18n-contract.test.mjs client/test/workspace-helpers.test.mjs
node --test server/test/mutation-requests.test.mjs server/test/chat-idempotency-api.test.mjs server/test/chat-stream-api.test.mjs server/test/external-ai-consent.test.mjs server/test/provider-contract.test.mjs server/test/message-reactions-api.test.mjs
```

- [ ] **Step 2: Run the complete applicable baseline**

Run:

```text
npm test
node --test "client/test/*.test.mjs"
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

- [ ] **Step 3: Inspect canonical database evidence**

For one replayed chat request, record privacy-safe counts proving one mutation row, one user message, one assistant message, one usage event, and one credit operation share the request ID. Record zero raw content or credentials in audit/usage records.

- [ ] **Step 4: Update audit findings**

For AUDIT-001 through AUDIT-005, record severity, user impact, reproduction, root cause, changed files, fix, exact tests, actual pass/fail counts, warnings, and residual risk. Keep AUDIT-006 through AUDIT-010 open unless their specific evidence is already implemented.

- [ ] **Step 5: Add the release note and commit the checkpoint**

```text
git add docs/audits/re-audit-baseline.md docs/audits/full-ux-security-audit.md CHANGELOG.md
git commit -m "docs: record p0 integrity evidence"
```

## Plan Self-Review

- Every P0 hypothesis in AUDIT-001 through AUDIT-005 maps to at least one red-green task and one server/browser verification.
- Provider truth and consent share one manifest rather than parallel constants.
- Request identity reaches messages, usage, jobs, credit operations, retries, reload recovery, and reactions.
- No task modifies frozen landing files or begins broad visual polish.
- All named functions and endpoints are introduced before later tasks consume them.
- AI control-plane, design-system, workspace, Settings/Admin, accessibility, reliability, and release subprojects remain required by the master spec and begin only after this P0 checkpoint.
