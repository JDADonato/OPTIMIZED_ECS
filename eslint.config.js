import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    {
        ignores: [
            'public/build/**',
            'node_modules/**',
            'vendor/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['resources/js/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2024,
            },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...react.configs.recommended.rules,
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'react/no-unknown-property': 'off',
            'no-constant-binary-expression': 'off',
            'no-constant-condition': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none',
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
        },
    },
];
