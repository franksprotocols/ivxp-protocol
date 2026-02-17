/**
 * Wait and timing utilities for async tests.
 *
 * Provides helpers for waiting on conditions and introducing delays.
 */

// ---------------------------------------------------------------------------
// delay
// ---------------------------------------------------------------------------

/**
 * Return a promise that resolves after the specified duration.
 *
 * @param ms - Duration in milliseconds.
 * @returns A promise that resolves after the delay.
 *
 * @example
 * ```typescript
 * await delay(100);
 * // 100ms have passed
 * ```
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// ---------------------------------------------------------------------------
// waitFor
// ---------------------------------------------------------------------------

/**
 * Options for the waitFor helper.
 */
export interface WaitForOptions {
  /** Maximum time to wait before timing out (ms). Defaults to 5000. */
  readonly timeout?: number;
  /** Interval between condition checks (ms). Defaults to 50. */
  readonly interval?: number;
  /** Error message to use on timeout. */
  readonly timeoutMessage?: string;
}

/**
 * Wait until a condition function returns true, polling at intervals.
 *
 * @param condition - An async function that returns true when the condition is met.
 * @param options - Polling and timeout configuration.
 * @returns A promise that resolves when the condition is met.
 * @throws If the condition is not met within the timeout period.
 *
 * @example
 * ```typescript
 * await waitFor(async () => {
 *   const order = await storage.get(orderId);
 *   return order?.status === "delivered";
 * }, { timeout: 3000 });
 * ```
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  options: WaitForOptions = {},
): Promise<void> => {
  const timeout = options.timeout ?? 5000;
  const interval = options.interval ?? 50;
  const timeoutMessage = options.timeoutMessage ?? `waitFor timed out after ${timeout}ms`;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await delay(interval);
  }

  throw new Error(timeoutMessage);
};

// ---------------------------------------------------------------------------
// flushMicrotasks
// ---------------------------------------------------------------------------

/**
 * Flush all pending microtasks (Promise callbacks, queueMicrotask, etc.).
 *
 * Useful in tests where you need to ensure all promise chains have resolved
 * before making assertions.
 */
export const flushMicrotasks = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
