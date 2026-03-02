// Primary approach: defineDocs() calls pointing directly to monorepo docs directories.
// Paths are resolved relative to this source.config.ts file (apps/docs/).
// OpenAPI operation pages are generated into ./content/protocol/api by prebuild scripts.
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

const docPostprocess = {
  postprocess: {
    includeProcessedMarkdown: true,
  },
} as const;

export const protocolDocs = defineDocs({
  dir: "../../docs/protocol",
  docs: docPostprocess,
});

export const specificationDocs = defineDocs({
  dir: "../../docs/ivxp-protocol-specification",
  docs: docPostprocess,
});

export const providerDocs = defineDocs({
  dir: "../../docs/provider",
  docs: docPostprocess,
});

export const userDocs = defineDocs({
  dir: "../../docs/user",
  docs: docPostprocess,
});

export const sdkDocs = defineDocs({
  dir: "../../docs/sdk",
  docs: docPostprocess,
});

export const openApiDocs = defineDocs({
  dir: "./content/protocol/api",
  docs: docPostprocess,
});

export default defineConfig();
