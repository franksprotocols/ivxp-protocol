const ENDPOINT_TIMEOUT_MS = 5000;

/**
 * Verify that a provider endpoint is reachable by making a HEAD request
 * to the /ivxp/catalog path.
 *
 * @returns An object with reachable status and optional error message
 */
export async function verifyProviderEndpoint(
  endpointUrl: string,
): Promise<{ reachable: boolean; error?: string }> {
  const catalogUrl = `${endpointUrl.replace(/\/$/, "")}/ivxp/catalog`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ENDPOINT_TIMEOUT_MS);

    const response = await fetch(catalogUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        reachable: false,
        error: `Provider returned status ${response.status} from ${catalogUrl}`,
      };
    }

    return { reachable: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        reachable: false,
        error: `Provider did not respond within ${ENDPOINT_TIMEOUT_MS}ms`,
      };
    }

    return {
      reachable: false,
      error: `Failed to reach provider at ${catalogUrl}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}
