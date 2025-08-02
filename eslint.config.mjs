import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import vitest from "@vitest/eslint-plugin";
import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath, URL } from "node:url";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default [
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),

  eslint.configs.recommended,

  ...tseslint.configs.strictTypeChecked,
  importPlugin.flatConfigs.recommended,

  vitest.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
      globals: {
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "no-implicit-coercion": "error",
      "no-throw-literal": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-var": "error",
      eqeqeq: ["error", "smart"],

      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-cycle": "warn",
      "import/no-mutable-exports": "error",
      "import/no-useless-path-segments": ["error", { noUselessIndex: true }],
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true, ignoreVoidOperator: false },
      ],
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-throw-literal": "error",
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignoreConditionalTests: true, ignoreMixedLogicalExpressions: true },
      ],
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: true,
        },
        node: { extensions: [".js", ".mjs", ".cjs", ".ts", ".cts", ".mts"] },
      },
    },
  },

  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**/*.ts"],
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    // Disable TS-specific rules for plain JS if desired:
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // TypeScript-only tweaks
  {
    files: ["**/*.ts", "**/*.mts", "**/*.cts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true, allowHigherOrderFunctions: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
