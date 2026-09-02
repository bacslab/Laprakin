import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default [
  {
    files: [
      'server/src/emails/**/*.js',
      'server/emails/**/*.js',
      'ops/laprakin-email-renderer-entry.mjs',
      'scripts/build-ops-email-renderer.mjs',
      'scripts/email-render-check.mjs',
      'server/test/email-templates.test.mjs',
    ],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
  {
    files: ['client/src/**/*.jsx'],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/control-has-associated-label': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
    },
  },
];
