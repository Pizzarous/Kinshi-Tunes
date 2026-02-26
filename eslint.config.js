import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";

export default [
    {
        ignores: ["dist/*", "yt-dlp-utils/*", "index.js", "eslint.config.js", ".gitignore"]
    },
    {
        files: ["**/*.ts"],
        linterOptions: {
            reportUnusedDisableDirectives: "warn"
        },
        plugins: {
            prettier: prettier,
            "@typescript-eslint": tseslint
        },
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./tsconfig.json"
            }
        },
        rules: {
            // TypeScript Recommended Rules
            // "@typescript-eslint/no-explicit-any": "warn", // Warns against using 'any' type
            "@typescript-eslint/no-unused-vars": "warn", // Error on unused variables
            "@typescript-eslint/explicit-function-return-type": "off", // Don't require return types on functions
            "@typescript-eslint/no-unnecessary-condition": "warn", // Warn about unnecessary conditionals
            "@typescript-eslint/no-empty-interface": "error", // No empty interfaces

            // Naming Conventions - Simplified and more flexible
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "default",
                    format: ["camelCase", "UPPER_CASE", "PascalCase", "snake_case"],
                    leadingUnderscore: "allow",
                    trailingUnderscore: "allow"
                }
            ],

            // Error Prevention
            "@typescript-eslint/no-floating-promises": "warn", // Warn about unhandled promises
            // '@typescript-eslint/no-misused-promises': 'error',    // Prevent promise misuse
            // '@typescript-eslint/no-unsafe-call': 'error',        // Prevent unsafe function calls
            // '@typescript-eslint/no-unsafe-member-access': 'error', // Prevent unsafe property access
            // '@typescript-eslint/no-unsafe-assignment': 'error',   // Prevent unsafe assignments

            // Code Style
            //"@typescript-eslint/consistent-type-definitions": ["error", "type"], // Prefer interfaces over types
            "@typescript-eslint/prefer-optional-chain": "error", // Prefer ?. over && chaining
            "@typescript-eslint/prefer-nullish-coalescing": "error", // Prefer ?? over ||

            // Prettier Integration
            "prettier/prettier": "error"

            // Comments - reportUnusedDisableDirectives handles unused eslint-disable warnings via linterOptions above
        }
    }
];
