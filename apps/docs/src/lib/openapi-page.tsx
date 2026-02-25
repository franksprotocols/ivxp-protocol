import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createOpenAPI } from "fumadocs-openapi/server";
import { createAPIPage } from "fumadocs-openapi/ui";

function resolveOpenApiSpecPath(): string {
  const candidates = [
    resolve(process.cwd(), "../../docs/protocol/openapi.yaml"),
    resolve(process.cwd(), "docs/protocol/openapi.yaml"),
    resolve(process.cwd(), "../docs/protocol/openapi.yaml"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

const openApiServer = createOpenAPI({
  input: [resolveOpenApiSpecPath()],
});

export const APIPage = createAPIPage(openApiServer);
