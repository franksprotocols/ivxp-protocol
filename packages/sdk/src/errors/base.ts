/**
 * IVXPError -- Base error class for all IVXP SDK errors.
 *
 * Extends the native Error class with an IVXP-specific error code
 * for programmatic error handling. All SDK errors should extend this class.
 *
 * Supports error cause chaining via the standard `cause` property,
 * enabling callers to inspect the original error that triggered the IVXP error.
 */
export class IVXPError extends Error {
  /**
   * Optional original error that caused this error.
   * Follows the Error.cause pattern from ES2022.
   */
  public readonly cause?: unknown;

  /**
   * Create a new IVXPError.
   *
   * @param message - Human-readable error description
   * @param code - IVXP error code (SCREAMING_SNAKE_CASE)
   * @param cause - Optional original error that caused this error
   */
  constructor(
    message: string,
    public readonly code: string,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "IVXPError";
    this.cause = cause;
  }
}
