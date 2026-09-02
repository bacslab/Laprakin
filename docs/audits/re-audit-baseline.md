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
