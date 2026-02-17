/**
 * IVXPError -- Base error class for all IVXP SDK errors.
 *
 * Extends the native Error class with an IVXP-specific error code
 * and optional details for programmatic error handling. All SDK errors
 * should extend this class.
 *
 * Supports error cause chaining via the standard `cause` property
 * (ES2022), enabling callers to inspect the original error that
 * triggered the IVXP error.
 */
export class IVXPError extends Error {
  /**
   * Refine the inherited `cause` property to be readonly.
   *
   * Uses `declare` so TypeScript emits no class field initializer,
   * which would otherwise overwrite the value set by
   * `super(message, { cause })`.
   */
  declare readonly cause: unknown;

  /**
   * Create a new IVXPError.
   *
   * @param message - Human-readable error description
   * @param code - IVXP error code (SCREAMING_SNAKE_CASE)
   * @param details - Optional structured data for debugging
   * @param cause - Optional original error that caused this error
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "IVXPError";

    // Maintains proper stack trace for where error was thrown (V8 only)
    const ErrorCtor = Error as {
      captureStackTrace?: (target: object, ctor: object) => void;
    };
    if (ErrorCtor.captureStackTrace) {
      ErrorCtor.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/debugging.
   *
   * Returns a plain object with the error name, code, message,
   * details, stack trace, and cause chain for structured logging.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
      cause:
        this.cause instanceof Error
          ? { name: (this.cause as Error).name, message: (this.cause as Error).message }
          : this.cause,
    };
  }
}
