declare module "fumadocs-mdx:collections/server" {
  import type { DocsCollectionEntry } from "fumadocs-mdx/runtime/server";

  export const protocolDocs: DocsCollectionEntry<"protocolDocs">;
  export const specificationDocs: DocsCollectionEntry<"specificationDocs">;
  export const providerDocs: DocsCollectionEntry<"providerDocs">;
  export const userDocs: DocsCollectionEntry<"userDocs">;
  export const sdkDocs: DocsCollectionEntry<"sdkDocs">;
  export const openApiDocs: DocsCollectionEntry<"openApiDocs">;
}
