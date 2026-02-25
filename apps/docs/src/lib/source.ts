import { sdkDocs, protocolDocs, openApiDocs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const sdkSource = loader({
  baseUrl: "/docs/sdk",
  source: sdkDocs.toFumadocsSource(),
});

export const protocolSource = loader({
  baseUrl: "/docs/protocol",
  source: protocolDocs.toFumadocsSource(),
});

export const openApiSource = loader({
  baseUrl: "/docs/protocol/api",
  source: openApiDocs.toFumadocsSource(),
});
