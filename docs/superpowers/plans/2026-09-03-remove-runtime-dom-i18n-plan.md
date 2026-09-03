# Remove Runtime DOM Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the full-tree DOM translation observer while preserving keyed Indonesian/English behavior on public, Workspace, Settings, and Admin surfaces.

**Architecture:** React components and locale resources remain the only owners of functional copy. `I18nRuntime` keeps language/theme context and document metadata but never walks, observes, or mutates rendered text. A source contract prevents the legacy mechanism from returning, and a real-browser matrix verifies that initial and dynamically rendered English copy comes from keys.

**Tech Stack:** React 18, JSON locale resources, Node test runner, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-09-02-laprakin-claude-grade-v2-design.md` and mission sections 2/AUDIT-006, 5, 15, 16, and 20.

## Global Constraints

- Landing markup, copy, assets, styles, motion, responsive behavior, and computed appearance remain frozen.
- Indonesian remains the fallback locale and ID/EN locale files retain identical key surfaces.
- Runtime translation may not use `MutationObserver`, `createTreeWalker`, `querySelectorAll`, direct `nodeValue` mutation, or attribute mutation.
- Streaming, retry, modal, notification, and route-lazy content must render correctly without a post-render translator.
- No normal functional UI text is below 12px; DM Mono remains 400/500 only.
- Changes follow red-green TDD, fresh verification, and logical commits.

---

### Task 1: Make keyed rendering the enforced runtime contract

**Files:**
- Modify: `client/test/i18n-contract.test.mjs`
- Modify: `client/src/i18n/I18nRuntime.jsx`
- Delete: `client/src/i18n/legacy.js`

**Interfaces:**
- Consumes: `createTranslator(language)`, `I18nContext`, `useResolvedTheme`, and `prefs.language`/`prefs.theme`.
- Produces: `I18nRuntime({ children })` that updates `document.documentElement.lang`, updates `body.dataset.laprakinTheme`, and supplies `{ language, t }` without touching descendant DOM.

- [ ] **Step 1: Replace the legacy-boundary assertion with a failing no-DOM-mutation contract**

```js
test('i18n runtime never walks or mutates rendered DOM', () => {
  assert.match(mainSource, /I18nRuntime/);
  assert.doesNotMatch(runtimeSource, /translateUiText|MutationObserver|createTreeWalker|querySelectorAll|nodeValue|setAttribute/);
  assert.equal(existsSync(new URL('../src/i18n/legacy.js', import.meta.url)), false);
});
```

- [ ] **Step 2: Run the contract and verify the intended failure**

Run: `node --test client/test/i18n-contract.test.mjs`

Expected: FAIL because `I18nRuntime.jsx` still imports `translateUiText`, creates a tree walker and observer, and `legacy.js` still exists.

- [ ] **Step 3: Reduce `I18nRuntime` to context plus document metadata**

```jsx
export default function I18nRuntime({ children }) {
  const { prefs } = useApp();
  const language = prefs?.language || 'id';
  const resolvedTheme = useResolvedTheme(prefs?.theme || 'system');
  const translateKey = useMemo(() => createTranslator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'id';
    document.body.dataset.laprakinTheme = resolvedTheme;
  }, [language, resolvedTheme]);
  return <I18nContext.Provider value={{ language, t: (value, values) => translateKey(value, values) }}>{children}</I18nContext.Provider>;
}
```

Delete `client/src/i18n/legacy.js` after confirming it has no other importers.

- [ ] **Step 4: Run the locale and complete client contracts**

Run: `node --test client/test/i18n-contract.test.mjs`

Expected: all locale/runtime contracts pass.

Run: `node --test --test-concurrency=1 "client/test/*.test.mjs"`

Expected: all client tests pass with no failed or skipped tests.

- [ ] **Step 5: Commit the runtime removal**

```text
git add client/test/i18n-contract.test.mjs client/src/i18n/I18nRuntime.jsx client/src/i18n/legacy.js
git commit -m "refactor: remove runtime dom translation"
```

### Task 2: Prove keyed locale behavior in a real browser

**Files:**
- Create: `scripts/i18n-ui-check.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the existing local API/Vite startup pattern from `scripts/admin-ai-ui-check.mjs`, development verification tokens, `laprakin-preferences`, and stable route accessibility names.
- Produces: `npm run test:i18n-ui`, a self-contained browser check using isolated temporary storage and a local Chromium executable.

- [ ] **Step 1: Write the failing browser assertions before adding the script implementation**

The check must prove:

```js
await page.evaluate(() => localStorage.setItem('laprakin-preferences', JSON.stringify({ language: 'en', theme: 'light' })));
await page.goto(`${webBase}/auth`);
await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
assert.equal(await page.locator('html').getAttribute('lang'), 'en');

await authenticateDevelopmentUser(page, apiBase);
await page.goto(`${webBase}/app`);
await page.getByRole('button', { name: 'New chat', exact: true }).waitFor();
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByRole('heading', { name: 'Workspace appearance', exact: true }).waitFor();

await page.getByRole('button', { name: 'Notifications', exact: true }).click();
await page.getByText('No notifications yet.', { exact: true }).waitFor();
assert.equal(await page.locator('body').evaluate((body) => body.querySelectorAll('[data-legacy-i18n]').length), 0);
```

The script must also switch to Indonesian through persisted preferences, reload, and assert representative Indonesian labels without a full-page mutation pass.

- [ ] **Step 2: Run the missing command and verify the intended failure**

Run: `npm run test:i18n-ui`

Expected: FAIL because the root script and browser harness do not exist yet.

- [ ] **Step 3: Implement the isolated harness**

Use random loopback ports, `mkdtemp`, `spawn`, condition-based readiness, and cleanup in `finally`. Reuse Playwright's installed Chromium as the cross-platform fallback after Edge/Brave candidates. Register and verify one development user through the API; never log cookies, CSRF values, verification tokens, or user content. Capture only `output/playwright/i18n/workspace-en.png` and `settings-id.png`.

Add the root command:

```json
"test:i18n-ui": "node scripts/i18n-ui-check.mjs"
```

- [ ] **Step 4: Run browser, client, lint, and build gates**

Run: `npm run test:i18n-ui`

Expected: public/Auth/Workspace/Settings initial and dynamically rendered ID/EN copy passes with no browser console errors or horizontal overflow at 390px.

Run: `node --test --test-concurrency=1 "client/test/*.test.mjs" && npm run lint && npm run typecheck && npm run build`

Expected: all commands exit 0; record any non-failing build advisory separately.

- [ ] **Step 5: Commit browser proof**

```text
git add scripts/i18n-ui-check.mjs package.json
git commit -m "test: prove keyed locale rendering"
```

### Task 3: Close AUDIT-006 without overstating the wider mission

**Files:**
- Modify: `docs/audits/full-ux-security-audit.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: fresh source, client, browser, lint, typecheck, build, and Landing-freeze evidence from Tasks 1–2.
- Produces: a finding record whose status and residual risks match the current repository.

- [ ] **Step 1: Verify the forbidden mechanism and legacy module are absent**

Run: `rg -n "translateUiText|MutationObserver|createTreeWalker|querySelectorAll|nodeValue|setAttribute" client/src/i18n client/src/main.jsx`

Expected: no runtime translation matches.

- [ ] **Step 2: Verify Landing-owned files remain unchanged from the audited base**

Run: `git diff --quiet 71e741fd4aeb2c90d469aaf9f5819e4fa29d97de -- client/src/pages/Landing client/src/landing.css client/src/styles/landing.css client/public/landing`

Expected: exit 0.

- [ ] **Step 3: Update the finding and changelog**

Record the changed files, red reproduction, root-cause removal, exact pass/fail counts, browser routes/viewports, screenshots, build advisory, and residual risk that every future functional string must be introduced as a locale key. Keep AUDIT-007 through AUDIT-009 and the overall production verdict open.

- [ ] **Step 4: Run final diff and evidence checks**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only the intended audit/changelog changes.

- [ ] **Step 5: Commit the audit closure**

```text
git add docs/audits/full-ux-security-audit.md CHANGELOG.md
git commit -m "docs: close runtime translation finding"
```

## Phase Exit Gate

AUDIT-006 closes only when the runtime contains no DOM walk/observer/mutation mechanism, `legacy.js` is gone, all locale/client contracts pass, public and authenticated ID/EN flows render correctly in a real browser including dynamic content and 390px, production build succeeds, and Landing-owned files remain unchanged from the audited base.
