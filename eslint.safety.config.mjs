import { config } from '@n8n/node-cli/eslint';
import tseslint from 'typescript-eslint';

/**
 * Stricter overlay on top of the official `@n8n/node-cli` ESLint config.
 * Does not replace `eslint.config.mjs` (Cloud `n8n.strict` stays on the default).
 *
 * Ban: production `as T` / angle-bracket assertions under nodes/ + credentials/.
 * Allow: `as const` (always permitted by consistent-type-assertions).
 * Ignore: tests (and dist via the base config).
 * Boundary: WebDAV/CalDAV methods use `assertHttpMethodIsValid` (no `as` allowlist).
 */
export default [
	...config,
	{
		files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
		ignores: ['**/*.test.ts', '**/test/**', '**/__tests__/**'],
		plugins: {
			'@typescript-eslint': tseslint.plugin,
		},
		rules: {
			// `as const` remains allowed with assertionStyle: 'never'
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{ assertionStyle: 'never' },
			],
		},
	},
];
