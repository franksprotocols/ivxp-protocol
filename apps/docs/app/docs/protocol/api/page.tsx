import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";

interface Endpoint {
  method: string;
  path: string;
  summary: string;
}

async function readOpenApiYaml(): Promise<string> {
  const candidatePaths = [
    resolve(process.cwd(), "../../docs/protocol/openapi.yaml"),
    resolve(process.cwd(), "../docs/protocol/openapi.yaml"),
    resolve(process.cwd(), "docs/protocol/openapi.yaml"),
  ];

  for (const filePath of candidatePaths) {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      // Try next path candidate.
    }
  }

  throw new Error("Unable to locate docs/protocol/openapi.yaml");
}

function parseEndpoints(openApiYaml: string): Endpoint[] {
  const lines = openApiYaml.split(/\r?\n/);
  const endpoints: Endpoint[] = [];

  let inPaths = false;
  let currentPath = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (!inPaths) {
      if (/^paths:\s*$/.test(line)) {
        inPaths = true;
      }
      continue;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(line)) {
      break;
    }

    const pathMatch = line.match(/^ {2}(\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete|options|head|trace):\s*$/i);
    if (!methodMatch || !currentPath) {
      continue;
    }

    let summary = "";
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      const nextLine = lines[lookahead] ?? "";

      if (/^ {4}(get|post|put|patch|delete|options|head|trace):\s*$/i.test(nextLine)) {
        break;
      }
      if (/^ {2}(\/[^:]+):\s*$/.test(nextLine)) {
        break;
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*:\s*$/.test(nextLine)) {
        break;
      }

      const summaryMatch = nextLine.match(/^ {6}summary:\s*(.+)\s*$/);
      if (summaryMatch) {
        summary = summaryMatch[1].replace(/^['"]|['"]$/g, "");
        break;
      }
    }

    endpoints.push({
      method: methodMatch[1].toUpperCase(),
      path: currentPath,
      summary,
    });
  }

  return endpoints;
}

export default async function ProtocolApiPage() {
  const openApiYaml = await readOpenApiYaml();
  const endpoints = parseEndpoints(openApiYaml);

  return (
    <DocsPage>
      <DocsTitle>API Reference</DocsTitle>
      <DocsDescription>
        Endpoint reference generated from <code>docs/protocol/openapi.yaml</code>.
      </DocsDescription>
      <DocsBody>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((endpoint) => (
              <tr key={`${endpoint.method}:${endpoint.path}`}>
                <td>
                  <code>{endpoint.method}</code>
                </td>
                <td>
                  <code>{endpoint.path}</code>
                </td>
                <td>{endpoint.summary || "No summary provided."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocsBody>
    </DocsPage>
  );
}
