# AI Provider Outage and Kill Switch

## Triage

Open `/admin/ai/health` and identify the affected provider/model, route error category, recent success/fallback rate, p50/p95 latency, first-token latency, queue depth, and circuit state. Telemetry is aggregate metadata and must not be augmented with prompt or output content.

## Containment choices

Use the narrowest control that protects users:

1. **Open one circuit** for an unhealthy provider/model. Enter the provider ID, model ID, reason, and exact confirmation `OPEN CIRCUIT <provider-id>:<model-id>`. Existing consent rules still govern every fallback.
2. **Enable AI maintenance** when all AI traffic must pause. Provide a user-safe message, reason, and exact confirmation `ENABLE AI MAINTENANCE`. The runtime must return `AI_MAINTENANCE` before provider transmission.
3. **Emergency-disable AI** from `/admin/ai/changes` only when configuration traffic must stop immediately. Provide a reason and exact confirmation `DISABLE AI`. This creates an immutable disabled revision; it does not edit the active revision in place.

Never add an undisclosed fallback during an incident. If no consented route remains, return the explicit degraded-state error.

## Recovery

1. Resolve or replace the provider outside Laprakin without copying user content into provider support channels.
2. Before clearing a circuit, run the built-in synthetic target canary. Clear requires exact confirmation `CLEAR CIRCUIT <provider-id>:<model-id>` and succeeds only after the canary.
3. Clear maintenance with reason and exact confirmation `CLEAR AI MAINTENANCE`.
4. If emergency-disable was used, test and activate a known-good draft or invoke last-known-good rollback with `ROLLBACK AI`.
5. Observe health for request success, latency, queue, circuit, and model availability. Verify the expected active revision and processor disclosure.

## Escalation and evidence

Escalate when multiple consented providers fail, a circuit immediately reopens, p95 latency remains above the operational threshold, or no last-known-good revision is available. Record only timestamps, route/provider/model identifiers, revision IDs, safe error categories, aggregate metrics, operator IDs, and audit event IDs.

