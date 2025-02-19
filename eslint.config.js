import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
    {
        ignores: [
            'dist/*',
            'yt-dlp-utils/*',
            'index.js',
            'eslint.config.js',
            '.gitignore'
        ]
    },
    {
        files: ['**/*.ts'],
        plugins: {
            prettier: prettier,
            '@typescript-eslint': tseslint,
            '@eslint-community/eslint-comments': eslintCommentsPlugin
        },
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json'
            }
        },
        rules: {
            // TypeScript Recommended Rules
            '@typescript-eslint/no-explicit-any': 'warn',          // Warns against using 'any' type
            '@typescript-eslint/no-unused-vars': 'error',         // Error on unused variables
            '@typescript-eslint/explicit-function-return-type': 'warn', // Require return types on functions
            '@typescript-eslint/no-unnecessary-condition': 'error', // Prevent unnecessary conditionals
            '@typescript-eslint/no-empty-interface': 'error',     // No empty interfaces

            // Naming Conventions
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'default',
                    format: ['camelCase', 'PascalCase'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'variable',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    prefix: ['I'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'enum',
                    format: ['PascalCase'],
                    leadingUnderscore: 'allow'
                }
            ],

            // Error Prevention
            '@typescript-eslint/no-floating-promises': 'error',   // Require promise handling
            '@typescript-eslint/no-unused-vars': 'warn',
            // '@typescript-eslint/no-misused-promises': 'error',    // Prevent promise misuse
            // '@typescript-eslint/no-unsafe-call': 'error',        // Prevent unsafe function calls
            // '@typescript-eslint/no-unsafe-member-access': 'error', // Prevent unsafe property access
            // '@typescript-eslint/no-unsafe-assignment': 'error',   // Prevent unsafe assignments

            // Code Style
            '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // Prefer interfaces over types
            '@typescript-eslint/prefer-optional-chain': 'error',  // Prefer ?. over && chaining
            '@typescript-eslint/prefer-nullish-coalescing': 'error', // Prefer ?? over ||

            // Prettier Integration
            'prettier/prettier': 'error',

            // Comments
            '@eslint-community/eslint-comments/no-unused-disable': 'warn',         // Warn about unused eslint-disable
            '@eslint-community/eslint-comments/no-unlimited-disable': 'error'     // No eslint-disable without specific rules

        }
    }
];