// Primary approach: two defineDocs() calls pointing directly to the monorepo docs directories.
// Paths are resolved relative to this source.config.ts file (apps/docs/).
// If cross-root path resolution fails at runtime (visible as missing pages on first `dev` run),
// fallback: copy content into apps/docs/content/{sdk,protocol}/ and change dirs to './content/sdk'
// and './content/protocol'.
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const sdkDocs = defineDocs({
  dir: "../../docs/sdk",
});

export const protocolDocs = defineDocs({
  dir: "../../docs/protocol",
});

export default defineConfig();
