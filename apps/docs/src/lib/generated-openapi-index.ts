import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface GeneratedOperationMeta {
  readonly method: string;
  readonly path: string;
}

const OPERATIONS_PATTERN = /operations=\{(\[[\s\S]*?\])\}/m;

export function parseOperationFromGeneratedMdx(content: string): GeneratedOperationMeta | null {
  const operationsMatch = content.match(OPERATIONS_PATTERN);

  if (!operationsMatch) {
    return null;
  }

  try {
    const operations = JSON.parse(operationsMatch[1]) as Array<{
      readonly method?: string;
      readonly path?: string;
    }>;

    const firstOperation = operations[0];
    if (!firstOperation?.method || !firstOperation.path) {
      return null;
    }

    return {
      method: firstOperation.method.toUpperCase(),
      path: firstOperation.path,
    };
  } catch {
    return null;
  }
}

export async function readGeneratedOpenApiIndex(
  rootDir?: string,
): Promise<Record<string, GeneratedOperationMeta>> {
  const candidateDirs =
    rootDir === undefined
      ? [
          resolve(process.cwd(), "content/protocol/api"),
          resolve(process.cwd(), "apps/docs/content/protocol/api"),
          resolve(process.cwd(), "../content/protocol/api"),
        ]
      : [rootDir];

  for (const candidateDir of candidateDirs) {
    const entries = await readdir(candidateDir, { withFileTypes: true }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    });
    const mdxFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"));

    if (mdxFiles.length === 0) {
      continue;
    }

    const operations = await Promise.all(
      mdxFiles.map(async (fileEntry) => {
        const slug = fileEntry.name.replace(/\.mdx$/i, "");
        const filePath = resolve(candidateDir, fileEntry.name);
        const content = await readFile(filePath, "utf8");
        const operation = parseOperationFromGeneratedMdx(content);

        return operation ? ([slug, operation] as const) : null;
      }),
    );

    return Object.fromEntries(
      operations.filter(
        (entry): entry is readonly [string, GeneratedOperationMeta] => entry !== null,
      ),
    );
  }

  return {};
}
