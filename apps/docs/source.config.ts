// Primary approach: defineDocs() calls pointing directly to monorepo docs directories.
// Paths are resolved relative to this source.config.ts file (apps/docs/).
// OpenAPI operation pages are generated into ./content/protocol/api by prebuild scripts.
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

const docPostprocess = {
  postprocess: {
    includeProcessedMarkdown: true,
  },
} as const;

const DOC_FILE_PATTERNS = ["**/*.{md,mdx}", "!**/CLAUDE.md", "!**/AGENTS.md"] as const;

export const protocolDocs = defineDocs({
  dir: "../../docs/protocol",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export const specificationDocs = defineDocs({
  dir: "../../docs/ivxp-protocol-specification",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export const providerDocs = defineDocs({
  dir: "../../docs/provider",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export const userDocs = defineDocs({
  dir: "../../docs/user",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export const sdkDocs = defineDocs({
  dir: "../../docs/sdk",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export const openApiDocs = defineDocs({
  dir: "./content/protocol/api",
  docs: {
    ...docPostprocess,
    files: [...DOC_FILE_PATTERNS],
  },
});

export default defineConfig();
