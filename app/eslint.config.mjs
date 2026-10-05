import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// NFR-SEC-008: only runInContext may set app.* settings, and only transaction-locally.
const setsApp = String.raw`/set_config|\bset\s+(session\s+|local\s+)?app\./i`;
const contextSelectors = [{
  selector: `TemplateElement[value.raw=${setsApp}], Literal[value=${setsApp}]`,
  message: 'Only runInContext (src/database/context.ts) may set app.* settings (NFR-SEC-008).',
}];

// FR-PRV-005, 008: only PersonalDataService may read contact details, because it logs each view.
const contactSelectors = [{
  selector: 'TemplateElement[value.raw=/app_person_contact/], Literal[value=/app_person_contact/]',
  message: 'Only PersonalDataService may call app_person_contact (FR-PRV-005, 008).',
}];

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
  // A flat-config block replaces, not merges, another block's options for the same rule. So the three blocks below
  // match disjoint files, and each file gets exactly the selectors that apply to it.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/database/context.ts', 'src/modules/privacy/personal-data.service.ts'],
    rules: { 'no-restricted-syntax': ['error', ...contextSelectors, ...contactSelectors] },
  },
  { files: ['src/database/context.ts'], rules: { 'no-restricted-syntax': ['error', ...contactSelectors] } },
  { files: ['src/modules/privacy/personal-data.service.ts'], rules: { 'no-restricted-syntax': ['error', ...contextSelectors] } },
);
