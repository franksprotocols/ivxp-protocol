/**
 * IHttpClient -- Interface for HTTP client operations.
 *
 * Provides a minimal, generic HTTP client interface for making GET and POST
 * requests. Designed for dependency injection so SDK consumers can use
 * any HTTP library (fetch, axios, etc.) or provide mocks for testing.
 */

/**
 * A value that can be safely serialized to JSON via `JSON.stringify()`.
 *
 * This constrains `post()` body types at compile time, preventing
 * accidentally passing non-serializable values (functions, symbols, etc.).
 */
export type JsonSerializable =
  | string
  | number
  | boolean
  | null
  | readonly JsonSerializable[]
  | { readonly [key: string]: JsonSerializable };

/**
 * Options for HTTP requests.
 */
export interface RequestOptions {
  /** Additional HTTP headers. */
  readonly headers?: Readonly<Record<string, string>>;

  /**
   * Request timeout in milliseconds.
   *
   * Implementations must reject the returned Promise with a timeout error
   * if the response is not received within this duration. If not specified,
   * implementations should apply a sensible default (recommended: 30000ms).
   * A value of 0 means no timeout.
   */
  readonly timeout?: number;

  /** AbortSignal for request cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Generic HTTP client interface.
 *
 * Responsibilities:
 * - Execute GET requests with optional configuration
 * - Execute POST requests with body and optional configuration
 * - Support generic response typing for type-safe API calls
 */
export interface IHttpClient {
  /**
   * Send an HTTP GET request.
   *
   * @typeParam T - Expected response body type
   * @param url - The URL to request
   * @param options - Optional request configuration
   * @returns Parsed response body of type T
   */
  get<T>(url: string, options?: RequestOptions): Promise<T>;

  /**
   * Send an HTTP POST request.
   *
   * @typeParam T - Expected response body type
   * @param url - The URL to request
   * @param body - Request body (must be JSON-serializable)
   * @param options - Optional request configuration
   * @returns Parsed response body of type T
   */
  post<T>(
    url: string,
    body: JsonSerializable,
    options?: RequestOptions,
  ): Promise<T>;
}
