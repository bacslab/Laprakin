# Landing and Admin Operations Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the centered, quieter landing page plus a coherent AI admin control plane, useful interactive monitoring, and relevance-ranked admin-wide search.

**Architecture:** Keep the existing admin shell and API authorization boundaries. Add a small pure search-ranking module on the server, extend the existing AI usage resource with filtered operational series, and render monitoring with composable Recharts components. The client command palette consumes the bounded endpoint and uses a static feature catalog only as a resilient fallback.

**Tech Stack:** React 18, Vite, Express, SQLite, Recharts, existing i18n/theme/router helpers.

**Spec:** `docs/superpowers/specs/2026-09-06-admin-monitoring-search-landing-design.md`

## Global Constraints

- Preserve privacy: no prompt, generated content, unmasked email, or permanent credential value leaves the server search/monitoring responses.
- Preserve capability checks on every admin API and result family.
- Preserve dark/light/system theme behavior and existing admin route URLs.
- Keep local preview running at `http://localhost:5173` and update it after each UI change.
- Use TDD: each production behavior gets a failing test before implementation.

---

### Task 1: Landing alignment and quiet line system

**Files:**
- Modify: `client/src/landing.css`
- Test: `client/test/landing-freeze-contract.test.mjs`

**Interfaces:**
- Consumes: existing `.fg-hero-copy`, `.fg-feature-row`, `.fg-step-card`, and `--fg-border` selectors.
- Produces: explicit hero paragraph centering, feature-copy alignment/heading parity, and reduced border tokens.

- [ ] **Step 1: Write the failing test**

Add assertions that `.fg-hero-copy p` has `text-align:center`, `margin-inline:auto`, and a max width; that feature-copy is left aligned; and that feature heading uses the step-card heading size token.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test client/test/landing-freeze-contract.test.mjs`
Expected: FAIL because the selectors are not yet declared.

- [ ] **Step 3: Implement the minimal CSS**

Append scoped rules:

```css
.fg-page .fg-hero-copy p { max-width: 700px; margin-inline: auto; text-align: center; }
.fg-page .fg-feature-copy { text-align: left; align-items: flex-start; }
.fg-page .fg-feature-copy h3 { font-size: var(--fg-step-title-size, 1.15rem); line-height: var(--fg-step-title-line, 1.15); }
.fg-page { --fg-border: color-mix(in srgb, #e7e0d8 26%, transparent); --fg-border-strong: color-mix(in srgb, #e7e0d8 38%, transparent); }
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test client/test/landing-freeze-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Refresh local preview**

Reload `http://localhost:5173/` and visually confirm the hero paragraph is centered, feature card copy is left aligned, and lines are subdued.

### Task 2: Embedded AI shell spacing and monitoring entry point

**Files:**
- Modify: `client/src/pages/Admin/ai/AdminAiWorkspace.jsx`
- Modify: `client/src/pages/Admin/LegacyAdminWorkspace.jsx`
- Modify: `client/src/styles/admin.css`
- Test: `client/test/admin-ai-contract.test.mjs`

**Interfaces:**
- Consumes: `embedded` prop and existing `AdminAiRoutes`.
- Produces: one parent admin header, a single AI content intro, and stable spacing tokens used by all AI modules.

- [ ] **Step 1: Write the failing test**

Assert embedded AI source does not render `admin-ai-topbar` or `admin-ai-embedded-nav`, and that admin CSS defines `--aai-gap-section`, `--aai-gap-control`, and a nonzero embedded page gap.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test client/test/admin-ai-contract.test.mjs`
Expected: FAIL on the duplicate embedded shell selectors.

- [ ] **Step 3: Implement the shell boundary**

Render the AI topbar and embedded navigation only when `embedded` is false. In embedded mode, keep `admin-ai-page` and module intros but rely on the parent header. Add spacing variables and replace zero/implicit gaps in embedded filter, panel, and action sections with the variables.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test client/test/admin-ai-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Refresh local preview**

Open an authenticated admin session locally, visit `/admin/ai/providers`, and confirm there is no duplicate topbar and no touching controls at desktop and narrow widths.

### Task 3: Filtered monitoring data contract

**Files:**
- Modify: `server/src/index.js`
- Modify: `client/src/lib/admin-ai.js`
- Test: `server/test/admin-ai-usage.test.mjs`
- Test: `client/test/admin-ai-contract.test.mjs`

**Interfaces:**
- Consumes: `/api/admin/ai/usage` and `ai_usage_events` operational fields.
- Produces: `days`, `provider`, `model`, `route`, and `status` filters plus `daily`, `hourly`, `routeHealth`, `summary`, and bounded option lists.

- [ ] **Step 1: Write the failing server tests**

Add a request test that calls `/admin/ai/usage?days=7&provider=nararouter&status=success`, verifies all returned rows are success/provider filtered, and asserts every daily row has `day`, `calls`, `errors`, `total_tokens`, and average latency fields. Add a blank/invalid filter test that returns a bounded default.

- [ ] **Step 2: Run the focused server test to verify it fails**

Run: `node --test server/test/admin-ai-usage.test.mjs`
Expected: FAIL because the endpoint currently ignores provider/status and lacks series metadata.

- [ ] **Step 3: Implement the bounded query**

Parse filters with `z`, build parameterized predicates (never interpolate values), calculate summary and daily series from `ai_usage_events`, and return masked provider/model identifiers already used by the AI admin UI.

- [ ] **Step 4: Add client query coverage**

Assert `createAdminAiClient().usage(filters)` serializes every supported filter and never sends an unbounded query.

- [ ] **Step 5: Run focused tests to verify green**

Run: `node --test server/test/admin-ai-usage.test.mjs client/test/admin-ai-contract.test.mjs`
Expected: PASS.

### Task 4: Recharts monitoring view

**Files:**
- Modify: `client/package.json`
- Modify: `client/src/pages/Admin/legacy/OverviewRoute.jsx`
- Create: `client/src/pages/Admin/legacy/AdminMonitoringCharts.jsx`
- Modify: `client/src/styles/admin.css`
- Modify: `client/src/i18n/id.json`
- Modify: `client/src/i18n/en.json`
- Test: `client/test/admin-monitoring-contract.test.mjs`

**Interfaces:**
- Consumes: filtered usage data from Task 3 and `/admin/overview` operational counts.
- Produces: `AdminMonitoringCharts({ usage, overview, filters, onFilterChange })` with accessible responsive charts and no `.activity-bars` dependency.

- [ ] **Step 1: Write the failing test**

Assert the monitoring source imports Recharts `ResponsiveContainer`, `AreaChart`, and `LineChart`; exposes period/provider/model/route/status controls; and no longer renders `.activity-bars` or a bar chart.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test client/test/admin-monitoring-contract.test.mjs`
Expected: FAIL because the module and dependency do not exist.

- [ ] **Step 3: Add the dependency**

Run: `npm install --workspace @laprakin/client recharts`

- [ ] **Step 4: Implement the chart component**

Render one summary row for availability/error/p95/tokens, an area chart for calls with success/error series, and a line chart for latency/token trend. Use CSS variables for strokes/fills, custom tooltip content, `role="img"`, and a text summary beneath each chart for screen readers. Keep filters in URL state and show stale data with retry.

- [ ] **Step 5: Replace the overview activity panel**

Use the chart component in `OverviewRoute` and remove the old bar chart panel while retaining the most important operational job/risk list.

- [ ] **Step 6: Run focused tests and refresh local preview**

Run: `node --test client/test/admin-monitoring-contract.test.mjs`; then open `/admin` locally and verify charts and filter changes at desktop/mobile widths.

### Task 5: Search ranking and server endpoint

**Files:**
- Create: `server/src/admin-search.js`
- Modify: `server/src/index.js`
- Test: `server/test/admin-search.test.mjs`

**Interfaces:**
- Produces: `rankAdminSearchResults(query, candidates, limit)` and `GET /api/admin/search?q=&kind=&limit=` returning `{ query, results, groups }`.

- [ ] **Step 1: Write the failing ranking tests**

Cover exact title > prefix > token > fuzzy score order, duplicate removal, empty query, and limit cap. Assert returned results contain only `category`, `title`, `subtitle`, `path`, `score`, and `matchedFields`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test server/test/admin-search.test.mjs`
Expected: FAIL because the ranking module and endpoint do not exist.

- [ ] **Step 3: Implement pure ranking**

Normalize Unicode/case, tokenize the query, score exact/prefix/token/fuzzy matches, sort deterministically by score then title, and cap results at 40.

- [ ] **Step 4: Implement capability-aware candidates**

Build candidates from a static feature catalog plus providers/models, masked user refs, alerts, audit actions, and feedback subjects only when the caller has the related capability. Use existing anonymous reference helpers and never include email/document/message content.

- [ ] **Step 5: Add the endpoint and run tests**

Validate `q` at 120 chars, `kind` against a fixed enum, `limit` 1–40, return `results:[]` for blank query, then run `node --test server/test/admin-search.test.mjs`.

### Task 6: Admin command palette UI

**Files:**
- Create: `client/src/pages/Admin/AdminGlobalSearch.jsx`
- Modify: `client/src/pages/Admin/LegacyAdminWorkspace.jsx`
- Modify: `client/src/styles/admin.css`
- Modify: `client/src/i18n/id.json`
- Modify: `client/src/i18n/en.json`
- Test: `client/test/admin-search-contract.test.mjs`

**Interfaces:**
- Consumes: `/api/admin/search` and `navigate` from the parent admin shell.
- Produces: `AdminGlobalSearch` with `Ctrl/⌘+K`, grouped results, keyboard arrows/Enter/Escape, debounce, recent queries, and local feature fallback.

- [ ] **Step 1: Write the failing client tests**

Assert the component registers the keyboard shortcut, renders a search input with an accessible label, displays grouped result links, highlights matches, and exposes a no-results state.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test client/test/admin-search-contract.test.mjs`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the command palette**

Use a 180ms debounce and `AbortController`, preserve the last five non-empty queries in local storage, provide arrow-key active index, and navigate to each result path. Render the trigger in the single admin header and the dialog through a portal-like fixed backdrop.

- [ ] **Step 4: Run focused tests and refresh local preview**

Run: `node --test client/test/admin-search-contract.test.mjs`; verify `Ctrl/⌘+K`, typing, keyboard selection, and escape locally.

### Task 7: Full verification and delivery

**Files:**
- Modify: none beyond prior tasks.

- [ ] **Step 1: Run all tests**

Run: `npm test` and `node --test --test-concurrency=1 "client/test/*.test.mjs"`.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check`.

- [ ] **Step 3: Inspect local UI**

Refresh `http://localhost:5173/`, `/admin`, `/admin/ai/health`, and the search palette; confirm theme and responsive spacing.

- [ ] **Step 4: Commit and deploy**

Commit with `feat: refresh landing and admin operations`; push `main`; trigger the existing Azure pull deploy; verify VM revision, production asset hashes, and `/api/health/ready`.
