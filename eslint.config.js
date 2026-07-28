import js from '@eslint/js';
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
];
