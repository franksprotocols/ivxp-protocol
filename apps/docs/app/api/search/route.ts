import { createSearchAPI } from "fumadocs-core/search/server";
import type { AdvancedIndex } from "fumadocs-core/search/server";
import {
  openApiSource,
  protocolSource,
  specificationSource,
  providerSource,
  userSource,
  sdkSource,
} from "@/lib/source";
import { isHiddenDocPage } from "@/lib/docs-visibility";

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
  indexes: [
    ...specificationSource.getPages().filter((page) => !isHiddenDocPage(page)),
    ...protocolSource.getPages(),
    ...providerSource.getPages().filter((page) => !isHiddenDocPage(page)),
    ...userSource.getPages().filter((page) => !isHiddenDocPage(page)),
    ...sdkSource.getPages().filter((page) => !isHiddenDocPage(page)),
    ...openApiSource.getPages(),
  ]
    .filter((page) => !isHiddenDocPage(page))
    .map(toAdvancedIndex),
});
