import { createSearchAPI } from "fumadocs-core/search/server";
import type { AdvancedIndex } from "fumadocs-core/search/server";
import { openApiSource, sdkSource, protocolSource } from "@/lib/source";

function toAdvancedIndex(page: { url: string; slugs: string[]; data: unknown }): AdvancedIndex {
  const data = page.data as {
    title?: string;
    description?: string;
    structuredData?: AdvancedIndex["structuredData"];
  };

  return {
    id: page.url,
    url: page.url,
    title: data.title ?? page.slugs[page.slugs.length - 1] ?? page.url,
    description: data.description,
    structuredData: data.structuredData ?? { headings: [], contents: [] },
  };
}

export const { GET } = createSearchAPI("advanced", {
  indexes: [...sdkSource.getPages(), ...protocolSource.getPages(), ...openApiSource.getPages()].map(
    toAdvancedIndex,
  ),
});
