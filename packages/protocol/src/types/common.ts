/**
 * Common types shared across all IVXP/1.0 protocol messages.
 *
 * Wire protocol fields use snake_case for Python compatibility.
 */

/**
 * IVXP protocol version identifier.
 */
export type ProtocolVersion = "IVXP/1.0";

/**
 * The canonical protocol version constant.
 */
export const PROTOCOL_VERSION: ProtocolVersion = "IVXP/1.0";

/**
 * Ethereum hex address type (checksummed or lowercase).
 */
export type HexAddress = `0x${string}`;

/**
 * Hex-encoded signature.
 */
export type HexSignature = `0x${string}`;

/**
 * Hex-encoded transaction hash.
 */
export type HexHash = `0x${string}`;

/**
 * Supported blockchain networks.
 */
export type NetworkId = "base-mainnet" | "base-sepolia";

/**
 * Supported delivery content formats.
 */
export type DeliveryFormat = "markdown" | "json" | "code";

/**
 * ISO 8601 timestamp string (e.g. "2026-02-05T12:00:00Z").
 */
export type ISOTimestamp = string;
