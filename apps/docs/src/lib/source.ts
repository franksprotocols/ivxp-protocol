import { sdkDocs, protocolDocs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const sdkSource = loader({
  baseUrl: "/docs/sdk",
  source: sdkDocs.toFumadocsSource(),
});

export const protocolSource = loader({
  baseUrl: "/docs/protocol",
  source: protocolDocs.toFumadocsSource(),
});
