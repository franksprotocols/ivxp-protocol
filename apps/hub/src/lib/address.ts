const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Validates whether a string is a well-formed Ethereum address.
 */
export function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

/**
 * Truncates an Ethereum address for display.
 * Returns empty string for falsy or invalid addresses.
 * Example: "0x1234567890abcdef1234567890abcdef12345678" -> "0x1234...5678"
 */
export function truncateAddress(
  address: string | undefined,
  startLength = 6,
  endLength = 4,
): string {
  if (!address) return "";
  if (!isValidAddress(address)) return "";
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}
