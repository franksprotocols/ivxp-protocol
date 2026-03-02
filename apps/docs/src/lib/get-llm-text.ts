/**
 * Converts a Fumadocs page into LLM-readable Markdown text.
 *
 * Requires `postprocess.includeProcessedMarkdown: true` in source.config.ts for all
 * doc sources that use this function, so that `page.data.getText('processed')` is available.
 */

// Intentionally typed as `any` to accept pages from all the different loaders
// (protocolSource, sdkSource, etc.) without needing a union type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLLMText(page: any): Promise<string> {
  const getText = page?.data?.getText;
  const processed: string = typeof getText === "function" ? await getText("processed") : "";

  const title: string = page?.data?.title ?? "";
  const url: string = page?.url ?? "";

  return `# ${title} (${url})\n\n${processed}`;
}
