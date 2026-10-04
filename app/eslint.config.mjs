import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// NFR-SEC-008: only runInContext may set app.* settings, and only transaction-locally.
const contextSelectors = [
  { selector: 'TemplateElement[value.raw=/set_config|\\bset\\s+(session\\s+|local\\s+)?app\\./i]', message: 'Only runInContext (src/database/context.ts) may set app.* settings (NFR-SEC-008).' },
  { selector: 'Literal[value=/set_config|\\bset\\s+(session\\s+|local\\s+)?app\\./i]', message: 'Only runInContext (src/database/context.ts) may set app.* settings (NFR-SEC-008).' },
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/context.ts'],
    rules: { 'no-restricted-syntax': ['error', ...contextSelectors] },
  },
);
