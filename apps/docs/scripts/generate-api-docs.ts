import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

const openApiServer = createOpenAPI({
  input: [resolve(projectRoot, "../../docs/protocol/openapi.yaml")],
});

await generateFiles({
  input: openApiServer,
  output: resolve(projectRoot, "content/protocol/api"),
  per: "operation",
});

process.stdout.write("✅ API docs generated at content/protocol/api/\n");
