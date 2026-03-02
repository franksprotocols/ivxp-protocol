export function isHiddenDocUrl(url: string): boolean {
  const normalized = url.replace(/\/+$/, "").toLowerCase();

  if (normalized.endsWith("/readme")) {
    return true;
  }

  return normalized === "/docs/protocol/ivxp-protocol-specification";
}

export function isHiddenDocPage(page: { url: string; slugs: string[] }): boolean {
  if (isHiddenDocUrl(page.url)) {
    return true;
  }

  const lastSlug = page.slugs[page.slugs.length - 1]?.toLowerCase();
  return lastSlug === "readme";
}
