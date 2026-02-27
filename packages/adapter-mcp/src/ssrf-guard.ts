/**
 * SSRF Guard — blocks requests to private/internal network addresses.
 *
 * Prevents Server-Side Request Forgery by rejecting URLs that resolve
 * to localhost, RFC-1918 private ranges, link-local, loopback, unique-local,
 * IPv4-mapped IPv6, and encoded IP addresses.
 */

const PRIVATE_RANGES: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0/,
  /^::ffff:/i, // IPv4-mapped IPv6
];

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "::1"]);

export function assertNotSSRF(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`SSRF guard: invalid URL "${url}"`);
  }

  // C1: restrict to http/https only
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(
      `SSRF guard: disallowed scheme "${parsed.protocol.replace(":", "")}"`,
    );
  }

  const rawHostname = parsed.hostname.toLowerCase();
  // Strip IPv6 brackets (Node URL keeps them: "[::1]" → "::1")
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;

  // C5: block hex-encoded IPs (e.g. 0x7f000001 for 127.0.0.1)
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    throw new Error(`SSRF guard: blocked hex-encoded IP "${hostname}"`);
  }

  // C5: block decimal-encoded IPs (e.g. 2130706433 for 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    throw new Error(`SSRF guard: blocked decimal-encoded IP "${hostname}"`);
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`SSRF guard: blocked hostname "${hostname}"`);
  }

  // C4: IPv6 link-local fe80::/10 (fe80–febf)
  if (/^fe[89ab]/i.test(hostname)) {
    throw new Error(`SSRF guard: blocked link-local IPv6 "${hostname}"`);
  }

  // C3: IPv6 unique-local fc00::/7 (fc and fd prefixes)
  if (/^f[cd]/i.test(hostname)) {
    throw new Error(`SSRF guard: blocked unique-local IPv6 "${hostname}"`);
  }

  for (const pattern of PRIVATE_RANGES) {
    if (pattern.test(hostname)) {
      throw new Error(`SSRF guard: blocked private IP "${hostname}"`);
    }
  }
}
