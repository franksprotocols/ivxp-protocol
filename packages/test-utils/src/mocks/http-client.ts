/**
 * MockHttpClient -- Test implementation of IHttpClient.
 *
 * Provides configurable HTTP GET/POST responses for tests.
 * Records all calls for assertion checking.
 */

import type { IHttpClient, JsonSerializable, RequestOptions } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Call record types
// ---------------------------------------------------------------------------

/**
 * Recorded arguments from a get() call.
 */
export interface HttpGetCall {
  readonly url: string;
  readonly options?: RequestOptions;
}

/**
 * Recorded arguments from a post() call.
 */
export interface HttpPostCall {
  readonly url: string;
  readonly body: JsonSerializable;
  readonly options?: RequestOptions;
}

// ---------------------------------------------------------------------------
// Route handler types
// ---------------------------------------------------------------------------

/**
 * A handler function for a registered URL pattern.
 */
export type RouteHandler<T = unknown> = (url: string, body?: JsonSerializable) => T | Promise<T>;

/**
 * A registered route for the mock HTTP client.
 */
interface RegisteredRoute {
  readonly method: "GET" | "POST";
  readonly urlPattern: string;
  readonly handler: RouteHandler;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for MockHttpClient.
 */
export interface MockHttpClientConfig {
  /** Default response for GET requests without a registered route. */
  readonly defaultGetResponse?: unknown;
  /** Default response for POST requests without a registered route. */
  readonly defaultPostResponse?: unknown;
  /** If set, all GET requests will reject with this error. */
  readonly getError?: Error;
  /** If set, all POST requests will reject with this error. */
  readonly postError?: Error;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Mock implementation of IHttpClient for testing.
 *
 * Features:
 * - URL-based route registration for targeted responses
 * - Configurable default responses and failure modes
 * - Call recording for assertion checking
 */
export class MockHttpClient implements IHttpClient {
  private readonly config: MockHttpClientConfig;

  // Mutable internal state: mocks need mutable fields for route registration
  // and call recording. This is intentional -- immutability applies to domain
  // objects, not test infrastructure.
  private routes: RegisteredRoute[] = [];
  private getCalls: HttpGetCall[] = [];
  private postCalls: HttpPostCall[] = [];

  constructor(config: MockHttpClientConfig = {}) {
    this.config = config;
  }

  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    this.getCalls.push({ url, options });

    if (this.config.getError) {
      throw this.config.getError;
    }

    const route = this.findRoute("GET", url);
    if (route) {
      return (await route.handler(url)) as T;
    }

    if (this.config.defaultGetResponse !== undefined) {
      return this.config.defaultGetResponse as T;
    }

    throw new Error(`MockHttpClient: No route registered for GET ${url}`);
  }

  async post<T>(url: string, body: JsonSerializable, options?: RequestOptions): Promise<T> {
    this.postCalls.push({ url, body, options });

    if (this.config.postError) {
      throw this.config.postError;
    }

    const route = this.findRoute("POST", url);
    if (route) {
      return (await route.handler(url, body)) as T;
    }

    if (this.config.defaultPostResponse !== undefined) {
      return this.config.defaultPostResponse as T;
    }

    throw new Error(`MockHttpClient: No route registered for POST ${url}`);
  }

  // -----------------------------------------------------------------------
  // Route registration
  // -----------------------------------------------------------------------

  /**
   * Register a handler for GET requests matching a URL pattern.
   *
   * Matching priority: exact match first, then path-prefix match
   * (pattern followed by '?' or '/' in the URL).
   */
  onGet<T>(urlPattern: string, handler: RouteHandler<T>): void {
    this.routes.push({
      method: "GET",
      urlPattern,
      handler: handler as RouteHandler,
    });
  }

  /**
   * Register a handler for POST requests matching a URL pattern.
   *
   * Matching priority: exact match first, then path-prefix match
   * (pattern followed by '?' or '/' in the URL).
   */
  onPost<T>(urlPattern: string, handler: RouteHandler<T>): void {
    this.routes.push({
      method: "POST",
      urlPattern,
      handler: handler as RouteHandler,
    });
  }

  // -----------------------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------------------

  /** Get all recorded get() calls. */
  getGetCalls(): readonly HttpGetCall[] {
    return [...this.getCalls];
  }

  /** Get all recorded post() calls. */
  getPostCalls(): readonly HttpPostCall[] {
    return [...this.postCalls];
  }

  /** Get the total number of get() calls. */
  getGetCallCount(): number {
    return this.getCalls.length;
  }

  /** Get the total number of post() calls. */
  getPostCallCount(): number {
    return this.postCalls.length;
  }

  /** Reset all recorded calls. */
  resetCalls(): void {
    this.getCalls = [];
    this.postCalls = [];
  }

  /** Clear all registered routes. */
  clearRoutes(): void {
    this.routes = [];
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private findRoute(method: "GET" | "POST", url: string): RegisteredRoute | undefined {
    return this.routes.find(
      (r) =>
        r.method === method &&
        (url === r.urlPattern ||
          url.startsWith(r.urlPattern + "?") ||
          url.startsWith(r.urlPattern + "/")),
    );
  }
}
