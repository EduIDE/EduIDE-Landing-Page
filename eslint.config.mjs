import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import noNull from 'eslint-plugin-no-null';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
    { ignores: ['dist', 'vite.config.ts', '**/*.d.ts'] },
    {
        ...js.configs.recommended,
        files: ['**/*.{ts,tsx}']
    },
    ...tsPlugin.configs['flat/recommended'].map(config => ({ ...config, files: ['**/*.{ts,tsx}'] })),
    { ...importPlugin.flatConfigs.errors, files: ['**/*.{ts,tsx}'] },
    { ...importPlugin.flatConfigs.warnings, files: ['**/*.{ts,tsx}'] },
    { ...importPlugin.flatConfigs.typescript, files: ['**/*.{ts,tsx}'] },
    { ...react.configs.flat.recommended, files: ['**/*.{ts,tsx}'] },
    prettier,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
                sourceType: 'module',
                ecmaVersion: 11,
                ecmaFeatures: { jsx: true }
            }
        },
        plugins: {
            'no-null': noNull,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'simple-import-sort': simpleImportSort
        },
        settings: {
            react: { version: 'detect' },
            'import/resolver': {
                typescript: { alwaysTryTypes: true, project: './tsconfig.json' }
            }
        },
        rules: {
            // Only the two classic hook rules: version 7's recommended set adds React
            // Compiler rules that App.tsx would need restructuring for.
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            ...{
                'sort-imports': 'off',
                'import/order': 'off',
                'simple-import-sort/imports': 'error',
                'simple-import-sort/exports': 'error',
                'react/jsx-uses-react': 'off',
                'react/react-in-jsx-scope': 'off',
                'no-redeclare': 'off',
                'no-inner-declarations': 'off',
                curly: 'error',
                'eol-last': 'off',
                eqeqeq: ['error', 'smart'],
                'guard-for-in': 'error',
                'no-caller': 'error',
                'no-eval': 'error',
                'no-restricted-imports': ['error', '..', '../index', '../..', '../../index'],
                'no-sequences': 'error',
                'no-throw-literal': 'error',
                'no-unused-expressions': [
                    'error',
                    {
                        allowShortCircuit: true,
                        allowTernary: true
                    }
                ],
                'no-unused-vars': 'off',
                'no-use-before-define': 'off',
                'max-len': 'off',
                'no-multiple-empty-lines': 'off',
                'no-underscore-dangle': 'off',
                quotes: 'off',
                semi: 'off',
                'space-before-function-paren': 'off',
                'one-var': ['error', 'never'],
                'arrow-body-style': ['error', 'as-needed'],
                'arrow-parens': 'off',
                'no-var': 'error',
                'prefer-const': [
                    'error',
                    {
                        destructuring: 'all'
                    }
                ],
                '@typescript-eslint/consistent-type-definitions': 'error',
                '@typescript-eslint/no-explicit-any': 'off',
                '@typescript-eslint/no-misused-new': 'error',
                '@typescript-eslint/no-namespace': 'off',
                '@typescript-eslint/no-use-before-define': 'off',
                '@typescript-eslint/no-unused-vars': [
                    'error',
                    {
                        args: 'none'
                    }
                ],
                'brace-style': 'off',
                'comma-dangle': 'off',
                indent: 'off',
                'no-invalid-this': 'warn',
                'no-new-wrappers': 'warn',
                'no-return-await': 'warn',
                'no-shadow': [
                    'warn',
                    {
                        hoist: 'all'
                    }
                ],
                'no-trailing-spaces': 'off',
                'no-void': 'warn',
                'prefer-object-spread': 'warn',
                radix: 'warn',
                'spaced-comment': 'off',
                'use-isnan': 'warn',
                '@typescript-eslint/explicit-function-return-type': [
                    'warn',
                    {
                        allowExpressions: true
                    }
                ],
                '@typescript-eslint/no-non-null-assertion': 'off',
                'import/export': 'off',
                'import/no-deprecated': 'error',
                'import/no-unresolved': [
                    'error',
                    {
                        ignore: ['vscode']
                    }
                ],
                'no-null/no-null': 'error',
                'import/default': 'off',
                'react/prop-types': 'off'
            }
        }
    }
];
