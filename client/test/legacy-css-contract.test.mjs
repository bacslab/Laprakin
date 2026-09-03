import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import test from 'node:test';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:js|jsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

test('retired landing-page root is absent from runtime source and compatibility selectors', async () => {
  const files = await sourceFiles('client/src');
  const runtime = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const compatibility = await readFile('client/src/styles.css', 'utf8');
  const compatibilitySelectors = [];
  postcss.parse(compatibility).walkRules((rule) => compatibilitySelectors.push(rule.selector));

  assert.doesNotMatch(runtime, /\blanding-page\b/);
  assert.doesNotMatch(compatibilitySelectors.join('\n'), /\.landing-page\b/);
  assert.match(runtime, /className="fg-page"/);
});

test('retired pre-Figma public class families are absent from runtime and compatibility CSS', async () => {
  const files = await sourceFiles('client/src');
  const runtime = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
  const compatibility = await readFile('client/src/styles.css', 'utf8');
  const compatibilitySelectors = [];
  postcss.parse(compatibility).walkRules((rule) => compatibilitySelectors.push(rule.selector));
  const retiredPrefixes = ['landing-', 'hero-', 'compare-', 'public-pricing-'];
  const retiredClasses = [
    'pricing-cards', 'pricing-cards-four', 'pricing-section', 'review-grid', 'reviews-section', 'service-grid', 'services-section',
    'workflow-section', 'workflow-steps', 'section-copy', 'section-index', 'final-section', 'footer-brand',
    'plain-link', 'announcement', 'quantity-control', 'monthly-count', 'plan-label', 'regular-window',
    'laprakin-window', 'regular-msg', 'regular-todos', 'doc-mini', 'tutorial-section', 'tutorial-frame',
    'tutorial-video-frame', 'tutorial-video-empty', 'tutorial-video-overlay', 'tutorial-controls',
    'tutorial-caption', 'tutorial-dots', 'tutorial-image-wrap', 'tutorial-image-nav', 'tutorial-image-count',
    'video-placeholder-index', 'video-placeholder-caption', 'auth-switch',
  ];
  const classNameValues = [...runtime.matchAll(/className\s*=\s*(?:\{\s*)?(["'`])([\s\S]*?)\1/g)].map((match) => match[2]);
  const runtimeClasses = new Set(classNameValues.flatMap((value) => value.split(/[^a-zA-Z0-9_-]+/).filter(Boolean)));

  for (const prefix of retiredPrefixes) {
    assert.equal([...runtimeClasses].some((className) => className.startsWith(prefix)), false, `Runtime still uses ${prefix}*`);
    assert.doesNotMatch(compatibilitySelectors.join('\n'), new RegExp(`\\.${prefix}[a-zA-Z0-9_-]*\\b`));
  }
  for (const className of retiredClasses) {
    assert.equal(runtimeClasses.has(className), false, `Runtime still uses ${className}`);
    assert.doesNotMatch(compatibilitySelectors.join('\n'), new RegExp(`\\.${className}(?![a-zA-Z0-9_-])`));
  }
});

test('legacy Admin selectors are feature-owned and do not use important overrides', async () => {
  const compatibility = await readFile('client/src/styles.css', 'utf8');
  const admin = await readFile('client/src/styles/admin.css', 'utf8');
  const compatibilitySelectors = [];
  postcss.parse(compatibility).walkRules((rule) => compatibilitySelectors.push(rule.selector));

  assert.doesNotMatch(compatibilitySelectors.join('\n'), /\.(?:admin(?:-[a-zA-Z0-9_-]+)?|cms-[a-zA-Z0-9_-]+|empty-admin|activity-bars|feedback-admin-body|retention-panel|status-(?:completed|ready|running|queued|failed)|risk-(?:reviewed|open|dismissed))(?![a-zA-Z0-9_-])/);
  assert.doesNotMatch(admin, /!important\b/);
  assert.match(admin, /@layer compatibility/);
  assert.match(admin, /\.admin-workspace\b/);
});
