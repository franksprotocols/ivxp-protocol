const PLACEHOLDER_PATTERNS = [/^your[_-]?project[_-]?id$/i, /^replace[_-]?me$/i, /^changeme$/i];

export function isValidWalletConnectProjectId(value: string | undefined): value is string {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}
