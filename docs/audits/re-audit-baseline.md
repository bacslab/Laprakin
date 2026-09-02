# Laprakin Claude-Grade V2 Re-Audit Baseline

## Audited State

- Repository: `https://github.com/bacslab/Laprakin`
- Audited application commit: `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`
- Working branch: `remediation/claude-grade-v2`
- Isolated worktree: `C:\Users\Muba Sayang\Documents\SaaS\Laprakin-worktrees\claude-grade-v2`
- Environment: Windows 10.0.19045, Node v24.11.0, npm 11.16.0
- Baseline date: 2026-09-02, Asia/Jakarta

`origin/main` was fetched before the worktree was created. It remained at the audited application commit. The main checkout was clean and was not modified.

## Existing Verification

| Command | Exit | Passed | Failed | Skipped | Warnings |
|---|---:|---:|---:|---:|---|
| `npm ci` | 0 | n/a | 0 | n/a | npm reported two install scripts not covered by `allowScripts` |
| `npm test` (first isolated cold run) | 1 | 108 | 1 | 0 | Admin MFA child server missed a fixed 30-second readiness deadline |
| focused admin MFA test, no code changes | 0 | 1 | 0 | 0 | SQLite experimental warning |
| `npm test` (fresh warm rerun) | 0 | 109 | 0 | 0 | SQLite experimental warnings |
| `node --test "client/test/*.test.mjs"` | 0 | 48 | 0 | 0 | none |
| `npm run lint` | 0 | n/a | 0 | n/a | none |
| `npm run typecheck` | 0 | n/a | 0 | n/a | none |
| `npm run build` | 0 | n/a | 0 | n/a | 654.85 kB minified vendor chunk exceeds Vite warning threshold |

The cold-start failure did not reproduce in the focused run (10.7 seconds) or complete warm rerun (9.6 seconds for the same test). No timeout was changed. It is recorded as baseline reliability evidence rather than silently discarded.

## Inventory

- Server routes declared in `server/src/index.js`: 164
- Client source files: 85
- Server source files: 23
- `client/src/styles.css`: 10,813 lines and 4,727 `!important` declarations
- Dedicated `workspace.css`, `admin.css`, `tokens.css`, and accessibility layers currently contain no `!important` declarations.
- The existing custom router lazy-loads top-level pages but treats `/admin/*` and `/app/*` as single route matches.
- The server entrypoint has 6,069 lines; `server/src/services.js` has 4,537 lines.

## P0 Evidence

| Finding | Baseline state | Direct evidence |
|---|---|---|
| AUDIT-001 | Contradicted | `apiStream` invokes `api()` for non-SSE and incomplete SSE responses; chat messages lack a request ID uniqueness boundary. |
| AUDIT-002 | Contradicted | Server returns `naraRouter`; generic Admin UI renders and inspects `gemini` and displays “Gemini API”. |
| AUDIT-003 | Contradicted | Server request schemas default external AI to false, but the authenticated client default is true and no versioned processor-consent record exists. |
| AUDIT-004 | Contradicted | Composer sends every Enter press that is not Shift+Enter or an IME composition; it does not read `prefs.enterToSend`. |
| AUDIT-005 | Contradicted | Reaction behavior is client-local; no durable reaction table or API exists. |
| AUDIT-006 | Contradicted | `I18nRuntime` creates a `MutationObserver` and repeatedly tree-walks root text and attributes. |
| AUDIT-007 | Contradicted | Compatibility budget permits 4,730 `!important`; measured count is 4,727. |
| AUDIT-008 | Missing rendered evidence | Theme helpers exist, but Settings must be tested in system/light/dark/high-contrast/reduced-motion modes. |
| AUDIT-009 | Contradicted | `LegacyAdminWorkspace` initializes overview, feedback, audit, CMS, usage, users, and alerts through one `Promise.all`. |
| AUDIT-010 | Contradicted | Admin endpoints predominantly use binary `requireAdmin` middleware rather than named capabilities. |

## Definition-of-Done Baseline

All 38 definition-of-done requirements are initially classified as `not proven`. Items 1–8, 18–19, 29, 33–36 are directly contradicted or missing. Landing freeze, CTA computed styles, full responsive behavior, keyboard completion, secret storage, SSRF defenses, provider activation/rollback, and complete CI gates have no current authoritative evidence and remain open.

## Phase Gate

Broad authenticated visual work is blocked until the P0 integrity plan closes AUDIT-001 through AUDIT-005 with fresh server, client, integration, and browser evidence.

## P0 Integrity Checkpoint — 2026-09-03

AUDIT-001 through AUDIT-005 are resolved and verified on `remediation/claude-grade-v2`. This checkpoint lifts only the integrity-phase gate; it does not change the overall `NO-GO` verdict while AUDIT-006 through AUDIT-010 and the remaining production controls are open.

| Evidence | Result | Warnings or limits |
|---|---:|---|
| Focused client P0 tests | 33/33 passed | none |
| Focused server P0 tests | 13/13 passed | Node SQLite experimental warning |
| Complete client suite | 59/59 passed | none |
| Complete server suite | 122/122 passed | Node SQLite experimental warnings |
| ESLint | passed | none |
| Typecheck | passed | none |
| Production build | passed | vendor JS 654.85 kB gzip 193.72 kB; CSS 621.82 kB gzip 98.21 kB; PDF worker 1.26 MB |
| Node API E2E | passed on a fresh isolated server/data directory | auth, profile, evidence, timeline, quality gate, template DOCX, restore, and verified password change; the first attempt against the long-running shared dev database was correctly rejected by accumulated registration-risk state |
| Rendered browser checks | passed | interactive browser used; workstation Python lacks Playwright, so `scripts/ui-workflow-check.py` was syntax-checked but not executed |

### Canonical replay evidence

The streamed chat integration test sends a successful request and then replays the same payload with the same request ID. Its read-only SQLite inspection proves:

| Record sharing the request ID | Count |
|---|---:|
| `mutation_requests` | 1 |
| `chat_messages` with role `user` | 1 |
| `chat_messages` with role `assistant` | 1 |
| `ai_usage_events` | 1 |
| `wallet_entries` | 1 |

The replay does not call the provider again and returns the same canonical message IDs. The mutation ledger stores a SHA-256 request hash rather than the raw request body. The test also searches serialized AI-usage and audit rows for the unique raw prompt and fake provider credential and finds neither. Message content remains only in the user-owned chat record, where the product requires it.

### Finding disposition

| Finding | Checkpoint state | Primary proof |
|---|---|---|
| AUDIT-001 | Resolved and verified | durable mutation ledger, single-POST stream recovery, canonical replay, shared request ID counts |
| AUDIT-002 | Resolved and verified | server-owned typed processor manifest and rendered NaraRouter disclosure |
| AUDIT-003 | Resolved and verified | default-off versioned consent enforced before provider, credit, and persistence |
| AUDIT-004 | Resolved and verified | keyboard truth table plus desktop and 390 px rendered behavior |
| AUDIT-005 | Resolved and verified | owner-scoped reaction API, persisted reload/reversal/removal, aggregate-only analytics |

Open work proceeds in risk order: secure AI control plane and secrets, capability-based Admin authorization, then the broader privacy, accessibility, performance, reliability, CI, and release evidence phases.
