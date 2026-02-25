/* eslint-env node */
/* eslint-disable no-console */

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const operationsPattern = /operations=\{(\[[\s\S]*?\])\}/m;
const generatedDir = resolve(import.meta.dirname, "../content/protocol/api");

const files = await readdir(generatedDir, { withFileTypes: true });
const mdxFiles = files.filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"));

if (mdxFiles.length === 0) {
  throw new Error("Generated API validation failed: no MDX files found in content/protocol/api.");
}

for (const fileEntry of mdxFiles) {
  const filePath = resolve(generatedDir, fileEntry.name);
  const content = await readFile(filePath, "utf8");
  const operationsMatch = content.match(operationsPattern);

  if (!operationsMatch) {
    throw new Error(
      `Generated API validation failed: missing operations block in ${fileEntry.name}.`,
    );
  }

  let operations;
  try {
    operations = JSON.parse(operationsMatch[1]);
  } catch {
    throw new Error(
      `Generated API validation failed: invalid operations JSON in ${fileEntry.name}.`,
    );
  }

  const firstOperation = operations[0];
  if (!firstOperation?.method || !firstOperation.path) {
    throw new Error(
      `Generated API validation failed: missing method/path in ${fileEntry.name}.`,
    );
  }
}

console.log(`✅ Generated API index validation passed (${mdxFiles.length} operation pages).`);
