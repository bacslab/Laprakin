# AI Provider Credential Rotation

## Preconditions

- Operator has `ai.credentials.rotate`; activation also requires `ai.routing.manage`.
- Recent MFA is valid.
- A second authorized approver is available if the change replaces the production processor set.
- Current health, active revision ID, and last-known-good revision ID have been recorded without copying credentials or user content.

## Procedure

1. Open `/admin/ai/providers` and select the provider.
2. In **Secret vault**, enter the new credential, an operational reason of at least eight characters, and the exact confirmation `ROTATE <provider-id>`.
3. Submit **Rotate credential**. The credential field must clear after success. Only masked metadata and a new draft revision may appear.
4. Open the draft in `/admin/ai/changes`. Confirm its parent is the currently intended revision and review the exact provider/model/route impact.
5. Run the connection test, model discovery when required, targeted capability tests, and synthetic route canaries. Do not use student prompts, uploads, or documents as canary input.
6. Confirm the draft is `tested`, evidence belongs to that exact revision, and evidence has not exceeded its ten-minute validity window.
7. Activate with a fresh operational reason and exact confirmation `ACTIVATE <revision-id>`. Supply the independent approval when the processor set changes in production.
8. Open `/admin/ai/health`. Confirm request success, route/model availability, circuit state, and the latest configuration revision. Keep the previous revision as last-known-good.
9. Revoke the old credential at the provider after the new revision is healthy and no in-flight work depends on it. Preserve only audit-safe identifiers.

## Failure handling

- A failed test must leave both active and last-known-good pointers unchanged.
- Expired evidence requires a new test; do not bypass the evidence window.
- If activation fails, keep the draft for diagnosis and continue serving the active revision.
- If post-activation health degrades, follow [AI provider outage](./ai-provider-outage.md) and [AI configuration rollback](./rollback.md).

## Verification record

Record revision IDs, timestamps, actor/approver IDs, reason, safe fingerprint, last four characters, test outcome, and health outcome. Never record the credential, provider response body, prompt, output, uploaded file, cookie, token, or MFA code.

