# Landing Freeze and Token Isolation Plan

**Goal:** Prove and preserve the frozen public Landing while correcting the two approved exceptions: real Plus Jakarta Sans Variable CTA rendering and Landing-owned accent tokens.

**Architecture:** A deterministic Playwright gate captures the audited pre-change Landing at desktop and mobile after fonts are ready. The post-change gate compares pixels while masking only the two CTA button rectangles, verifies the exact computed CTA font contract, and proves workspace theme/accent preferences cannot alter Landing pixels. Landing colors remain hard-coded through Landing-owned semantic tokens.

**Constraints:** Do not change Landing copy, layout, dimensions, spacing, assets, responsive behavior, colors, shadows, or motion. Only CTA glyph rendering and token aliases may differ. Keep the full mission verdict at NO-GO while unrelated requirements remain open.

## Task 1 — Establish the pre-change baseline

- [x] Add a deterministic browser harness with API stubs, reduced motion, `document.fonts.ready`, desktop/mobile viewports, computed CTA evidence, and pixel comparison.
- [x] Capture the audited pre-change screenshots and CTA rectangles before editing production Landing styles.
- [x] Add a failing source contract for Landing token isolation and the exact variable-font CTA family.

## Task 2 — Apply only approved Landing exceptions

- [x] Introduce `--landing-accent` and `--landing-accent-secondary` without changing their computed lime/mint values.
- [x] Stop Landing selectors from reading generic/user-controlled accent tokens.
- [x] Set both CTA buttons to the installed `Plus Jakarta Sans Variable` family at weight 700 and make the child span explicitly inherit font/weight.
- [x] Do not alter any CTA box-model, paint, position, text, or motion declaration.

## Task 3 — Prove the freeze

- [x] Verify desktop and mobile computed font family/weight for both CTA buttons and spans.
- [x] Require zero changed pixels outside the union of pre/post CTA rectangles.
- [x] Require exact screenshot equality when local workspace theme/accent preferences change.
- [x] Confirm lime/mint computed token values and no horizontal overflow.
- [x] Save before/after/diff screenshots and machine-readable metrics.

## Task 4 — Close the Landing gate honestly

- [x] Run focused contracts, full client tests, lint, typecheck, production build, and Landing browser gate.
- [x] Update the audit, design evidence, and changelog with exact results and residual risks.
- [ ] Commit the implementation and evidence in logical checkpoints.

## Exit Gate

The Landing gate closes only when the real variable font is loaded, hero/final CTA button and span compute to the same weight of at least 700 on desktop and mobile, workspace preferences produce no Landing pixel changes, and the only pre/post pixel differences lie inside the CTA rectangles.
