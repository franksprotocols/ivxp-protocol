/**
 * Service handler types for the IVXP Demo Provider.
 *
 * Defines the contract that all demo service implementations must follow.
 * Each handler receives a validated input and order ID, and returns a
 * ServiceResult containing the deliverable, content hash, and standardized
 * metadata structure.
 */

/** Valid MIME types for service deliverables. */
const VALID_CONTENT_TYPES = [
  "application/json",
  "text/plain",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;

export type ValidContentType = (typeof VALID_CONTENT_TYPES)[number];

/**
 * Check if a content type is valid.
 */
export function isValidContentType(contentType: string): contentType is ValidContentType {
  return VALID_CONTENT_TYPES.includes(contentType as ValidContentType);
}

/**
 * Standardized metadata structure for all service deliverables.
 *
 * All services must include these base fields. Additional service-specific
 * fields can be added but must not conflict with these names.
 */
export interface ServiceMetadata {
  /** The service type that generated this deliverable. */
  readonly service_type: string;
  /** The order ID this deliverable belongs to. */
  readonly order_id: string;
  /** ISO 8601 timestamp when the deliverable was created. */
  readonly timestamp: string;
  /** Additional service-specific metadata fields. */
  readonly [key: string]: unknown;
}

/**
 * Result returned by a service handler after execution.
 *
 * The `content` field is the raw deliverable (string or binary).
 * The `contentType` field is the MIME type for the deliverable.
 * The `contentHash` field is the SHA-256 hex hash for verification.
 * The `metadata` field contains standardized service metadata.
 */
export interface ServiceResult {
  /** The deliverable content (string for text, Uint8Array for binary). */
  readonly content: string | Uint8Array;
  /** MIME type of the deliverable content (must be a valid type). */
  readonly contentType: ValidContentType;
  /** SHA-256 hex hash of the deliverable content (64 hex characters). */
  readonly contentHash: string;
  /** Standardized metadata about the deliverable. */
  readonly metadata: ServiceMetadata;
}

/**
 * A service handler processes a service request and produces a deliverable.
 *
 * @param orderId - The unique order identifier
 * @param description - The service request description from the client
 * @returns A ServiceResult with the deliverable content and hash
 * @throws Error if the input is invalid or processing fails
 */
export type ServiceHandlerFn = (orderId: string, description: string) => Promise<ServiceResult>;

/**
 * A registered service handler with its type identifier.
 */
export interface ServiceHandler {
  /** The service type this handler processes (e.g., "text_echo"). */
  readonly serviceType: string;
  /** The handler function. */
  readonly execute: ServiceHandlerFn;
}
