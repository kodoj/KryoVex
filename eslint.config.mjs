import js from '@eslint/js';
import ts from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    ignores: [
      'dist/**',
      'release/**',
      'release/app/dist/**',
      'release/build/**',
      '.erb/**',
      '.erb/dll/**',
      'node_modules/**',
      'coverage/**',
      'logs/**',
      '**/*.log',
      '.eslintcache',
      '.idea/**',
      'npm-debug.log.*',
      '**/*.css.d.ts',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      import: importPlugin,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'no-console': 'off',
      // Legacy JS in this repo intentionally uses dynamic patterns.
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      'react/jsx-key': 'off',
      'jsx-a11y/no-redundant-roles': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/mouse-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/role-supports-aria-props': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
      parser: ts,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '19.1' } },
    plugins: {
      import: importPlugin,
      '@typescript-eslint': tsPlugin,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // TS-specific checks tuned for this mixed legacy/transitional codebase.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'react/jsx-uses-react': 'off',
      'no-undef': 'off',
      'no-irregular-whitespace': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      'react/jsx-key': 'off',
      'jsx-a11y/no-redundant-roles': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/alt-text': 'off',
      'jsx-a11y/mouse-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/role-supports-aria-props': 'off',
      'no-console': 'off',
    },
  },
  // Stricter checks for first-party source only (incremental quality pass).
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'react/jsx-key': 'warn',
      'react/jsx-no-target-blank': 'warn',
    },
  },
];