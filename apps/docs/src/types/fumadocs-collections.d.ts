declare module "fumadocs-mdx:collections/server" {
  import type { DocsCollectionEntry } from "fumadocs-mdx/runtime/server";

  export const sdkDocs: DocsCollectionEntry<"sdkDocs">;
  export const protocolDocs: DocsCollectionEntry<"protocolDocs">;
  export const openApiDocs: DocsCollectionEntry<"openApiDocs">;
}
