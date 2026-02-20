import { createSearchAPI } from "fumadocs-core/search/server";
import { sdkSource, protocolSource } from "@/lib/source";

export const { GET } = createSearchAPI("advanced", {
  indexes: [
    ...sdkSource.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: page.data.structuredData,
    })),
    ...protocolSource.getPages().map((page) => ({
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: page.data.structuredData,
    })),
  ],
});
