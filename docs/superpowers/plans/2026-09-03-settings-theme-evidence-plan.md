# Settings Theme and Motion Evidence Plan

**Goal:** Close AUDIT-008 with rendered evidence that Settings follows Workspace system/light/dark, high-contrast, and reduced-motion preferences without a forced-dark surface.

**Architecture:** Workspace owns the resolved theme, contrast, and motion attributes. Settings consumes the same semantic tokens. A small pure motion policy combines the explicit user preference with `prefers-reduced-motion`; a real-browser harness exercises live changes and persistence.

**Constraints:** Landing-owned files remain untouched. No broad compatibility CSS deletion belongs in this slice; AUDIT-007 remains open. All changes follow red-green verification and logical commits.

## Task 1 — Resolve system reduced motion

- [x] Add a failing pure policy test for user/system reduced motion and a source contract proving Workspace consumes the resolved value.
- [x] Implement `resolveReducedMotion` and a matchMedia-backed hook with live system-change handling.
- [x] Replace the direct `prefs.reducedMotion` attribute decision in `LegacyWorkspaceView`.
- [x] Run focused and complete client tests.
- [x] Commit the motion policy.

## Task 2 — Add rendered Settings matrix

- [ ] Reproduce the missing `npm run test:settings-ui` command.
- [ ] Add an isolated Playwright harness with temporary API data and a verified development user.
- [ ] Verify system-dark, forced-light, forced-dark, and a live system-light change using computed backgrounds, text contrast, and workspace/body state.
- [ ] Verify high-contrast tokens change and persist after reload.
- [ ] Verify user and system reduced-motion policy, Settings focus return/Escape, desktop and 390px overflow, and unexpected browser errors.
- [ ] Capture `output/playwright/settings/settings-light.png`, `settings-dark.png`, and `settings-mobile-high-contrast.png`.
- [ ] Run browser, complete client, lint, typecheck, and build gates.
- [ ] Commit the browser evidence.

## Task 3 — Close AUDIT-008 honestly

- [ ] Confirm Landing-owned files are unchanged from `71e741fd4aeb2c90d469aaf9f5819e4fa29d97de`.
- [ ] Update the audit, changelog, and this plan with exact fresh evidence.
- [ ] Keep AUDIT-007, AUDIT-009, and wider Settings requirements open.
- [ ] Run `git diff --check` and commit the audit closure.

## Exit Gate

AUDIT-008 closes only when computed browser behavior proves Settings is light in light mode, dark in dark mode, follows live system color-scheme changes, increases high-contrast token separation, applies reduced motion for either user or system preference, persists user settings after reload, and reflows at 390px without blocking overflow.
