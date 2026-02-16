import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "crypto/index": "src/crypto/index.ts",
    "payment/index": "src/payment/index.ts",
    "core/index": "src/core/index.ts",
    "errors/index": "src/errors/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["@ivxp/protocol", "viem", "zod"],
  outDir: "dist",
});
