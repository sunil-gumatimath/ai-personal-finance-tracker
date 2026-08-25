import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores([
		"dist",
		"node_modules",
		".agents",
		"coverage",
		".kimchi",
		".vercel",
		"output",
	]),

	// Base rules for the whole codebase (frontend + API + scripts + tests).
	// No environment globals here — those are scoped per-runtime below.
	{
		files: ["**/*.{ts,tsx}"],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			ecmaVersion: 2020,
		},
		rules: {
			// Keep these as warnings so the editor still surfaces them, but they
			// don't block CI on legacy code. Tighten back to 'error' once the
			// existing occurrences are cleaned up.
			"@typescript-eslint/no-explicit-any": "warn",
			"no-empty": ["warn", { allowEmptyCatch: true }],
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					// Allow intentionally-unused args/vars prefixed with _
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},

	// Frontend code runs in the browser.
	{
		files: ["src/**/*.{ts,tsx}"],
		extends: [
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			globals: globals.browser,
		},
		rules: {
			// Keep these as warnings so the editor still surfaces them, but they
			// don't block CI on legacy code. Tighten back to 'error' once the
			// existing occurrences are cleaned up.
			"react-refresh/only-export-components": "warn",
			// react-hooks v7 emits "Cannot create components during render" from
			// the new static-components rule on a few pre-existing card/chart
			// patterns. Warn until those components are refactored out of render
			// scope.
			"react-hooks/static-components": "warn",
			"react-hooks/rules-of-hooks": "warn",
		},
	},

	// API routes and helper scripts run under Bun/Node, not a browser.
	{
		files: ["api/**/*.ts", "scripts/**/*.ts"],
		languageOptions: {
			globals: globals.node,
		},
	},
]);
