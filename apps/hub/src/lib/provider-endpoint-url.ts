const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Provider endpoints must use HTTPS, except localhost-style hosts for local development.
 */
export function isAllowedProviderEndpointUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol === "https:") {
      return true;
    }

    return url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
