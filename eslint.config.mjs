import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "no-console": "warn",
    },
  },
  {
    files: ["docs/sdk/examples/**/*.ts"],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
        self: "readonly",
        TextEncoder: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
        requestAnimationFrame: "readonly",
        alert: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.source/**",
      "**/coverage/**",
      "_bmad/**",
      "_bmad-output/**",
      ".venv/**",
      "**/.venv/**",
      ".agent/**",
    ],
  },
);
