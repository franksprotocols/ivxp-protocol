import {
  sdkDocs,
  protocolDocs,
  specificationDocs,
  providerDocs,
  userDocs,
  openApiDocs,
} from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const protocolSource = loader({
  baseUrl: "/docs/protocol",
  source: protocolDocs.toFumadocsSource(),
});

export const specificationSource = loader({
  baseUrl: "/docs/ivxp-protocol-specification",
  source: specificationDocs.toFumadocsSource(),
});

export const providerSource = loader({
  baseUrl: "/docs/provider",
  source: providerDocs.toFumadocsSource(),
});

export const userSource = loader({
  baseUrl: "/docs/user",
  source: userDocs.toFumadocsSource(),
});

export const sdkSource = loader({
  baseUrl: "/docs/sdk",
  source: sdkDocs.toFumadocsSource(),
});

export const openApiSource = loader({
  baseUrl: "/docs/protocol/api",
  source: openApiDocs.toFumadocsSource(),
});
