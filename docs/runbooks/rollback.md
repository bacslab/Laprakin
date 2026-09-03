# AI Configuration Rollback

## When to roll back

Rollback is appropriate after a verified post-activation regression, unsafe route assignment, unexpected capability failure, or provider behavior that cannot be contained by a single circuit. Do not use rollback to bypass a failed or expired test.

## Preconditions

- Operator has `ai.routing.manage` and recent MFA.
- The target is the recorded last-known-good revision or an explicitly selected eligible superseded/tested revision.
- The incident record contains the current active and target revision IDs, reason, impact, and processor-consent implications—never credential or user content.

## Procedure

1. Open `/admin/ai/changes` and compare **Active** with **Last known good**.
2. Inspect the target revision, provider/model states, routes, capability evidence, and processor-manifest impact.
3. Select rollback, enter a concrete reason, and type the exact confirmation `ROLLBACK AI`.
4. The server atomically moves the active pointer to the target. In-flight requests retain their captured starting revision; new requests receive the restored revision.
5. Open `/admin/ai/health` and verify the active revision, route/model availability, circuits, request success, fallback rate, latency, and latest configuration change.
6. Confirm Settings/first-use processor disclosure matches the restored runtime. A material processor change must invalidate stale consent instead of silently rerouting data.

## Expected failure behavior

- If no eligible target exists, the server returns `AI_CONFIGURATION_ROLLBACK_UNAVAILABLE` and pointers remain unchanged.
- A failed draft test or activation never moves active or last-known-good pointers.
- Repeating rollback without a distinct eligible target is rejected.

## Recovery verification

Run the focused lifecycle and API checks before closing the incident:

```text
node --test server/test/ai-configuration-repository.test.mjs
node --test server/test/ai-configuration-service.test.mjs
node --test server/test/admin-ai-control-plane-api.test.mjs
```

Preserve the audit event, revision IDs, operator, reason, and aggregate health result. Do not preserve provider responses, prompts, outputs, files, tokens, cookies, or MFA codes.

