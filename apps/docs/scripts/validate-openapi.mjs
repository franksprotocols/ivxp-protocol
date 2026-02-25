/* eslint-env node */
/* eslint-disable no-console */

import { resolve } from "node:path";
import { createOpenAPI } from "fumadocs-openapi/server";

const projectRoot = resolve(import.meta.dirname, "..");
const openApiPath = resolve(projectRoot, "../../docs/protocol/openapi.yaml");

const openApiServer = createOpenAPI({
  input: [openApiPath],
});

const schemas = await openApiServer.getSchemas();
const documents = Object.values(schemas);

if (documents.length === 0) {
  throw new Error("OpenAPI validation failed: no parsed schema documents were found.");
}

const firstDocument = documents[0];
if (!firstDocument?.bundled?.paths || Object.keys(firstDocument.bundled.paths).length === 0) {
  throw new Error("OpenAPI validation failed: no endpoints were found in `paths`.");
}

console.log("✅ OpenAPI validation passed.");
