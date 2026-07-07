import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.agents', 'coverage', '.kimchi']),

  // Base rules for the whole codebase (frontend + API + scripts + tests)
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Keep these as warnings so the editor still surfaces them, but they
      // don't block CI on legacy code. Tighten back to 'error' once the
      // existing occurrences are cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      // react-hooks v7 emits "Cannot create components during render" from
      // the new static-components rule on a few pre-existing card/chart
      // patterns. Warn until those components are refactored out of render
      // scope.
      'react-hooks/static-components': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          // Allow intentionally-unused args/vars prefixed with _
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])
