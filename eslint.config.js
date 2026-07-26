import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.agents` / `.claude` hold vendored third-party skill scripts, and `release`
  // is electron-builder output — none of it is our source to lint.
  globalIgnores(['dist', 'release', '.agents', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Capitalised names are components rendered in JSX (which the base rule
      // can't see) and `_` marks a deliberate discard — both apply to
      // destructured parameters too, not just plain variables.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // Reading a const/let above its declaration is a temporal dead zone
      // error that throws on every render and takes the whole app down. It
      // shipped once; the linter catches it now. Function declarations hoist,
      // so they stay allowed.
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    },
  },
  {
    // Build config runs in Node, not the browser.
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
