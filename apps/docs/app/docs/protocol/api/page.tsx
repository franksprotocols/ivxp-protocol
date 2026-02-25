import Link from "next/link";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { readGeneratedOpenApiIndex } from "@/lib/generated-openapi-index";
import { openApiSource } from "@/lib/source";

interface ProtocolPageMeta {
  title?: string;
  description?: string;
  _openapi?: {
    method?: string;
  };
}

export default async function ProtocolApiPage() {
  const generatedOperations = await readGeneratedOpenApiIndex();

  const apiPages = openApiSource
    .getPages()
    .map((page) => {
      const meta = page.data as ProtocolPageMeta;
      const slug = page.slugs[page.slugs.length - 1] ?? "";
      const fallbackTitle = slug || page.url;
      const operation = generatedOperations[slug];
      const method = operation?.method ?? meta._openapi?.method?.toUpperCase() ?? "UNKNOWN";
      const path = operation?.path ?? "UNKNOWN";

      return {
        url: page.url,
        method,
        path,
        title: meta.title ?? fallbackTitle,
        description: meta.description ?? "No description provided.",
      };
    })
    .sort((left, right) => {
      const pathOrder = left.path.localeCompare(right.path, "en-US", { sensitivity: "base" });
      if (pathOrder !== 0) {
        return pathOrder;
      }

      return left.method.localeCompare(right.method, "en-US", { sensitivity: "base" });
    });

  return (
    <DocsPage>
      <DocsTitle>API Reference</DocsTitle>
      <DocsDescription>
        OpenAPI reference generated from <code>docs/protocol/openapi.yaml</code>.
      </DocsDescription>
      <DocsBody>
        {apiPages.length === 0 ? (
          <p>
            No generated API pages found. Run <code>pnpm --filter @ivxp/docs prebuild</code> and
            refresh this page.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Page</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {apiPages.map((page) => (
                <tr key={page.url}>
                  <td>
                    <code>{page.method}</code>
                  </td>
                  <td>
                    <code>{page.path}</code>
                  </td>
                  <td>
                    <Link href={page.url}>{page.title}</Link>
                  </td>
                  <td>{page.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DocsBody>
    </DocsPage>
  );
}
