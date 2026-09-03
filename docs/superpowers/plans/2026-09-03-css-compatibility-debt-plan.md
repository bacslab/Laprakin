# CSS Compatibility Debt Reduction Plan

**Goal:** Close AUDIT-007 by deleting stale compatibility generations and moving live rules into feature-owned layers without changing rendered behavior.

**Architecture:** Work in bounded deletion checkpoints. Each checkpoint starts from a source-proven dead selector family or a single live surface, lowers the enforced `!important` budget, and reruns the relevant visual/browser gates. The committed Landing freeze is the non-negotiable public baseline.

**Constraints:** No new `!important`. No broad selector rewrites without rendered evidence. Preserve active Workspace, Settings, Auth, Pricing, and Admin behavior. Keep unrelated mission blockers open.

## Task 1 — Delete the retired Landing root

- [x] Prove no client source renders `.landing-page`; current Landing exclusively renders `.fg-page`.
- [x] Add a failing contract that rejects `.landing-page` selectors in the compatibility sheet and lowers the budget from 4,730 to 3,060.
- [x] Remove only selector branches rooted at `.landing-page`, retaining live selector branches in mixed rules.
- [x] Prove the committed Landing screenshot hashes, computed CTA metrics, and preference-independence result remain unchanged.
- [x] Run full client, lint, typecheck, and build gates; commit.

## Task 2 — Delete retired unscoped public-surface selectors

- [ ] Inventory old Landing/Auth/Pricing class names against current JSX and dynamic class construction.
- [ ] Remove only classes with zero source/runtime ownership, splitting mixed selectors safely.
- [ ] Lower the budget again and verify Landing, Auth, Pricing, Settings, and Admin browser surfaces.
- [ ] Commit the deletion checkpoint and exact counts.

## Task 3 — Migrate live Admin compatibility rules

- [ ] Capture representative Admin AI and all legacy Admin route visual/computed baselines.
- [ ] Collapse superseded Admin generations into `styles/admin.css` with semantic tokens and no `!important`.
- [ ] Delete the replaced compatibility blocks and lower the budget.
- [ ] Run Admin source/API/browser/build gates; commit.

## Task 4 — Migrate live Workspace and Settings compatibility rules

- [ ] Capture representative empty chat, active chat, document, upload, modal, Settings, theme, and 390px baselines.
- [ ] Move final live declarations into feature-owned section/component layers with bounded selectors and no `!important`.
- [ ] Delete superseded Workspace/Settings generations and lower the budget to the actual remainder.
- [ ] Run workflow, Settings, i18n, accessibility, client, and build gates; commit.

## Task 5 — Close AUDIT-007 honestly

- [ ] Remove or rename the compatibility sheet once its remaining declarations are demonstrably foundational rather than overrides.
- [ ] Enforce zero new `!important` and a final explicit count aligned with the mission acceptance threshold.
- [ ] Update architecture/style ownership documentation, audit evidence, build size, screenshots, and residual risks.
- [ ] Commit closure only after all rendered checkpoints pass.

## Exit Gate

AUDIT-007 closes only when compatibility generations no longer control live feature visuals, the enforced `!important` count has been reduced to the accepted final threshold, all relevant browser matrices pass, and the Landing freeze reports zero out-of-mask changes.
