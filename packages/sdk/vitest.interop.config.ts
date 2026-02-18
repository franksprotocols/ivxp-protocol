import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/interop/**/*.test.ts", "src/__tests__/interop/**/*.spec.ts"],
    exclude: [
      "src/__tests__/integration/**",
      "src/__tests__/docs-examples.test.ts",
      "src/payment/transfer.test.ts",
      "src/payment/verify.test.ts",
    ],
  },
});
