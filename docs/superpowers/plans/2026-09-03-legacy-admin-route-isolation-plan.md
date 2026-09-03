# Legacy Admin Route Isolation Plan

**Goal:** Close AUDIT-009 by replacing the non-AI Admin monolith's global initialization with route-owned lazy resources, independent failure recovery, query state, and bounded list navigation.

**Architecture:** Keep a stable Admin shell and route map. Each route module owns its loader, loading/error/stale state, retry, filters, pagination, and mutations. Shared resource primitives provide consistent last-updated and retry behavior. Admin AI remains isolated and unchanged.

**Constraints:** Preserve every existing Admin function and capability boundary. Landing remains frozen, including CMS-owned public rendering. Do not treat frontend hiding as authorization. Use red-green tests and logical commits.

## Task 1 — Remove global failure coupling

- [ ] Add a failing contract proving the legacy console does not request seven unrelated resources in one `Promise.all` and does not require overview/CMS data before rendering its shell.
- [ ] Import the missing loading icon and add an accessible active-route loading/error/retry state.
- [ ] Load only data required by the current route; reload only that route after mutations and relevant Admin events.
- [ ] Prove direct navigation to overview, users, feedback, CMS, audit, and alerts does not request unrelated initial endpoints.
- [ ] Run client, lint, typecheck, build, and browser gates; commit.

## Task 2 — Extract lazy route modules

- [ ] Create a stable `AdminLegacyRoutes` resolver for every existing non-AI Admin path.
- [ ] Move overview, credits, alerts, integrations, feedback, risk, CMS, audit, and retention into domain modules.
- [ ] Lazy-load existing pricing, users, appeals, broadcasts, and updates panels at their route boundaries.
- [ ] Give every route its own resource state, skeleton, retry, and last-updated indicator.
- [ ] Add route-level error boundaries so a render failure cannot take down the shell.
- [ ] Verify each deep link and code-split bundle in build/browser evidence; commit.

## Task 3 — Bounded queries and URL state

- [ ] Add server-backed pagination/cursors and validated filters where an Admin list can grow without bound.
- [ ] Persist filter/cursor state in the URL for users, alerts, feedback, audit, appeals, and other list routes.
- [ ] Preserve selected-user deep links at `/admin/users/:id` without exposing content or PII beyond capability rules.
- [ ] Add direct API and browser tests for filter isolation, next/previous navigation, reload, and error recovery.
- [ ] Commit client/server query contracts and migrations if required.

## Task 4 — Close AUDIT-009 honestly

- [ ] Run all server/client/integration/browser/build gates affected by the extraction.
- [ ] Confirm no blocking all-resource initialization remains and Landing-owned files are unchanged.
- [ ] Update audit, changelog, architecture notes, screenshots, and residual risks.
- [ ] Commit the audit closure while keeping unrelated mission blockers open.

## Exit Gate

AUDIT-009 closes only when every non-AI Admin deep link loads independently, unrelated endpoint failure cannot block it, each module can retry and reports freshness, growing lists are bounded and filterable through URL state, render failures remain local, browser evidence covers direct routes and failure recovery, and no business operation is lost.
