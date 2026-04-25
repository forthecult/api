import eslintReact from "@eslint-react/eslint-plugin";
import eslintJs from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import eslintParserTypeScript from "@typescript-eslint/parser";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import eslintPluginReadableTailwind from "eslint-plugin-readable-tailwind";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  eslintJs.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // fatima.eslint.plugin, // import { linter as fatima } from "fatima",
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "scripts/**",
      "src/lib/wagmi-connector-stub.js",
    ],
  },
  {
    files: [
      "src/**/*.{ts,tsx}",
      "next.config.ts",
      "drizzle.config.ts",
      "*.d.ts",
    ],
    ...eslintReact.configs["recommended-typescript"],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.json",
        tsconfigRootDir: rootDir,
      },
    },
  },
  {
    files: ["admin/**/*.{ts,tsx}"],
    ...eslintReact.configs["recommended-typescript"],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.json",
        tsconfigRootDir: path.join(rootDir, "admin"),
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "admin/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "@eslint-react/component-hook-factories": "warn",
      "@eslint-react/jsx-no-key-after-spread": "warn",
      "@eslint-react/no-nested-component-definitions": "warn",
      "@eslint-react/unsupported-syntax": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-empty-function": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/prefer-for-of": "warn",
      "no-empty": "warn",
      "no-fallthrough": "warn",
      "no-useless-assignment": "warn",
      "prefer-const": "warn",
      "preserve-caught-error": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: [
      "src/app/checkout/crypto/open-wallet-modal.tsx",
      "src/app/checkout/crypto/solana-wallet-stub.tsx",
    ],
    rules: {
      "@eslint-react/error-boundaries": "off",
      "@eslint-react/rules-of-hooks": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
  perfectionist.configs["recommended-natural"],
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "readable-tailwind": eslintPluginReadableTailwind,
    },
    rules: {
      ...eslintPluginReadableTailwind.configs.warning.rules,
      "@eslint-react/hooks-extra/no-direct-set-state-in-use-effect": "off",
      "@eslint-react/no-array-index-key": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
    settings: {
      "readable-tailwind": {
        entryPoint: "src/css/globals.css",
      },
    },
  },
  // fatima.eslint.noEnvRule("**/*.tsx"),
);
