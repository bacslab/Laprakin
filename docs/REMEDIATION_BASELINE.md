# Laprakin Remediation Baseline

Date: 2026-09-01
Branch: refactor/ux-remediation
Source revision: 7dc21bc (fix: harden admin and private file storage)
Node: v24.11.0
npm: 11.16.0

## Working-tree and dependency safety

The baseline was run in a clean linked worktree created from local main.
The source checkout had an existing user change in
.github/workflows/test.yml; that file was not copied into or modified by
this remediation branch.

npm ci completed successfully from package-lock.json and installed 443
packages. npm reported three packages with pending install-script approval:
esbuild@0.28.1, sharp@0.34.5, and esbuild@0.25.12. No lockfile diff was
produced.

## Required checks

| Command | Result | Evidence |
| --- | --- | --- |
| npm test | PASS | 71 tests, 71 passed, 0 failed |
| npm run test:e2e | PASS after API startup | E2E passed: auth, profile, evidence, timeline, quality gate, template DOCX, restore, and email-verified password changes |
| npm run test:workflow-api | PASS | Workflow API passed: brief, identity, document quiz, and gated download flow |
| npm run test:admin-ops | PASS | Admin operations passed: credits, restrictions/appeals, broadcasts, pricing, telemetry, and realtime alerts |

The first E2E attempt from the original checkout failed with
ECONNREFUSED localhost:4000 because the API was not running. The clean
worktree baseline was repeated with npm start running on port 4000 and
then passed.

The test process emitted Node's existing experimental node:sqlite warning;
this did not change any result.

## Static architecture inventory

| Area | Baseline |
| --- | ---: |
| client/src/main.jsx | 4,119 lines |
| client/src/styles.css | 10,804 lines |
| !important occurrences | 4,739 |
| @media blocks | 109 |
| server/src/index.js | 5,699 lines |
| server/src/services.js | 4,402 lines |
| React.lazy references | 0 |
| node:sqlite references in server/src/index.js | 0 |

The audit source described 3,513 !important occurrences and a node:sqlite
import in index.js; the current revision differs. The numbers above are
measured from the current worktree and are authoritative for this
remediation.

## CSS breakpoint inventory

The 109 media blocks use these distinct conditions:

| Condition family | Occurrences | Static status |
| --- | ---: | --- |
| max-width: 460px | 4 | Active candidate: landing, admin, and compact mobile rules |
| max-width: 520px | 2 | Active candidate: settings and compact panels |
| max-width: 560px | 2 | Active candidate: responsive forms/panels |
| max-width: 600px | 1 | Active candidate: legal/mobile layout |
| max-width: 620px | 5 | Active candidate: admin/settings/mobile layouts |
| max-width: 640px | 3 | Active candidate: legal and compact layouts |
| max-width: 700px | 19 | Active candidate: workspace mobile navigation and chat |
| max-width: 720px | 2 | Active candidate: pricing and chat content |
| max-width: 760px | 26 | Active candidate: dominant landing/workspace/admin breakpoint |
| max-width: 780px | 2 | Active candidate: workspace panels |
| max-width: 820px | 1 | Active candidate: document/workspace layout |
| max-width: 860px | 2 | Active candidate: workspace/admin collapse |
| max-width: 880px | 1 | Active candidate: admin collapse |
| max-width: 900px | 5 | Active candidate: admin and content grids |
| max-width: 920px | 3 | Active candidate: landing/workspace collapse |
| max-width: 980px | 2 | Active candidate: document/admin grids |
| max-width: 1040px | 3 | Active candidate: pricing/content grids |
| max-width: 1050px | 2 | Active candidate: pricing grids |
| max-width: 1080px | 1 | Active candidate: landing layout |
| max-width: 1100px | 1 | Active candidate: wider workspace layout |
| max-height: 680px + min-width: 761px | 1 | Active candidate: desktop viewport height |
| max-height: 540px + min-width: 761px | 1 | Active candidate: short desktop viewport |
| max-height: 720px | 1 | Active candidate: viewport-height layout |
| prefers-reduced-motion: reduce | 4 | Active accessibility behavior |
| max-width: 700px + reduced motion | 1 | Active accessibility behavior |

The same condition appears with and without spacing after @media and inside
multiple later override sections. Static inspection found no media block that
can be conclusively classified as dead: every condition family contains
selectors for current landing, workspace, admin, legal, settings, or
accessibility surfaces. Runtime breakpoint screenshots are therefore a
required verification step for CSS work; the inventory does not justify
removing any responsive block by itself.

## Fase 0 gate

The unit, workflow, admin, and correctly configured E2E baselines are green.
This document records the remaining npm install-script warning and the
measured CSS inventory so later phases can distinguish existing state from
regressions. No application source code was changed for Fase 0.

## Final verification snapshot — 2026-09-02

The remediation branch was re-verified from a fresh process after the latest
changes. The final counts are intentionally recorded separately from the
baseline so a partial migration is not mistaken for a completed rewrite.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | PASS | 99 tests, 99 passed, 0 failed |
| `npm run test:e2e` | PASS | Clean server on port 4019 with isolated data directory |
| `npm run test:workflow-api` | PASS | Workflow API contract passed |
| `npm run test:admin-ops` | PASS | Admin operations contract passed |
| `npm run build` | PASS | Ops renderer and client build completed; route chunks emitted |
| `npm run lint` | PASS | Existing configured ESLint targets passed |
| `npm run typecheck` | PASS | `tsc -p tsconfig.email.json` passed |
| `node --test client/test/*.test.mjs` | PASS | 24 tests, 24 passed |
| release/security/stream focused tests | PASS | 8 tests, 8 passed |
| `node scripts/check-release-metadata.mjs` | PASS | Root/client/server all `21.0.6` |
| `git diff --check` | PASS | No whitespace errors |

Final measured inventory:

| Area | Final |
| --- | ---: |
| `client/src/main.jsx` | 3,953 lines |
| `client/src/Landing.jsx` | 594 lines |
| `client/src/styles.css` | 10,812 lines |
| `!important` occurrences | 4,739 |
| `@media` blocks | 109 |
| `server/src/index.js` | 5,956 lines |
| `server/src/services.js` | 4,511 lines |
| JSX files above 500 lines | 2 (`main.jsx`, `Landing.jsx`) |

Fresh browser checks covered the dark desktop state at 1280×720 for landing,
auth, workspace/tutorial, and admin/monitoring. The available browser control
surface did not expose viewport resizing, so mobile and tablet screenshots are
not claimed as completed evidence. The build still reports a large global CSS
chunk and large vendor chunks; these remain follow-up work.
