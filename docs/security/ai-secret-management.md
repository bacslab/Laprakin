# AI Credential Secret Management

## Security contract

Laprakin never treats an environment file, JWT secret, device secret, token secret, MFA material, database password, or browser storage as an AI credential vault. Provider credentials are accepted only by the authenticated Admin AI mutation API and are never returned after save.

Production must use one of these stores:

1. Azure Key Vault through managed identity (`AI_SECRET_STORE=azure-key-vault` and `AZURE_KEY_VAULT_URL`), or
2. the envelope store with an independently generated 32-byte `AI_CREDENTIAL_MASTER_KEY`.

Startup validation fails closed when neither option is ready. Development may create an ephemeral envelope store only when the calling harness explicitly opts in; production cannot.

## Envelope records

The SQLite envelope implementation stores only:

- an opaque reference and provider ID;
- monotonically increasing secret and key versions;
- AES-256-GCM ciphertext;
- a random 12-byte IV and 16-byte authentication tag;
- AAD bound to the application namespace, provider ID, secret version, and key version;
- a 16-character SHA-256 fingerprint, last four characters, actor, and timestamps.

There is no plaintext column. Deletion destroys ciphertext, IV, and tag before marking the version deleted. The public API exposes only masked metadata such as `Configured •••• ABCD`.

## Provisioning

- Generate key material with a cryptographically secure secret manager. Never paste it into a ticket, chat, shell transcript, CI log, screenshot, or repository file.
- Inject it through the deployment platform's secret facility.
- Keep `AI_CREDENTIAL_KEY_VERSION` stable for a deployed key generation.
- Grant the application identity only the minimum Key Vault secret permissions when Azure is used.
- Run `npm run test:production-config` before deployment. A failure in the AI secret-store check blocks release.

## Master-key rotation

For the envelope store:

1. Back up the database using the approved backup procedure and verify that the backup is restorable.
2. Generate a new independent 32-byte key in the deployment secret manager.
3. Move the current key into `AI_CREDENTIAL_PREVIOUS_KEYS`, keyed by its current `AI_CREDENTIAL_KEY_VERSION`. Do not print the JSON value.
4. Install the new key as `AI_CREDENTIAL_MASTER_KEY` and advance `AI_CREDENTIAL_KEY_VERSION`.
5. Deploy one instance, run production configuration validation, and test every active provider with synthetic canaries.
6. Rotate each provider credential through Admin AI so new versions are encrypted by the current key.
7. Confirm no active revision refers to a record encrypted by the old key before removing it from the previous-key ring.

Never remove an old decryption key while an active or last-known-good revision still references it.

## Provider credential rotation evidence

Credential replacement creates an immutable child configuration revision. The original revision and secret version remain unchanged. Activation still requires fresh synthetic test evidence and recent MFA. Tests assert that plaintext does not occur in the returned revision or audit entries.

Reproducible checks:

```text
node --test server/test/ai-secret-store.test.mjs
node --test server/test/ai-configuration-service.test.mjs
node --test server/test/admin-ai-control-plane-api.test.mjs
npm run test:production-config
```

## Incident response

If exposure is suspected, enable AI maintenance or emergency-disable AI, revoke the provider credential at the provider, rotate the vault/master key if its confidentiality is uncertain, replace the credential through a new draft, run synthetic tests, activate it, and review metadata-only audit events. Never place the suspected credential in the incident record.

