// Primary approach: defineDocs() calls pointing directly to monorepo docs directories.
// Paths are resolved relative to this source.config.ts file (apps/docs/).
// OpenAPI operation pages are generated into ./content/protocol/api by prebuild scripts.
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const protocolDocs = defineDocs({
  dir: "../../docs/protocol",
});

export const specificationDocs = defineDocs({
  dir: "../../docs/ivxp-protocol-specification",
});

export const providerDocs = defineDocs({
  dir: "../../docs/provider",
});

export const userDocs = defineDocs({
  dir: "../../docs/user",
});

export const sdkDocs = defineDocs({
  dir: "../../docs/sdk",
});

export const openApiDocs = defineDocs({
  dir: "./content/protocol/api",
});

export default defineConfig();
