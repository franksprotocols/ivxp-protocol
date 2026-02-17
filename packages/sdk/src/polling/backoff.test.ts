/**
 * Polling with exponential backoff unit tests.
 *
 * Tests pollWithBackoff for correct retry behavior, exponential delay
 * doubling, jitter distribution, max attempt enforcement, early exit
 * on success, abort signal support, input validation, and the
 * pollOrderStatus wrapper.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { IVXPError } from "../errors/base.js";
import { MaxPollAttemptsError } from "../errors/specific.js";
import { pollWithBackoff, pollOrderStatus } from "./backoff.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect delays passed to setTimeout by replacing globalThis.setTimeout.
 *
 * Returns a mutable array that accumulates delays as they are recorded.
 * Each intercepted call resolves its callback synchronously so the
 * polling loop completes without real waiting.
 */
function interceptDelays(): number[] {
  const delays: number[] = [];

  vi.spyOn(globalThis, "setTimeout").mockImplementation(((cb: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);

  return delays;
}

// ---------------------------------------------------------------------------
// MaxPollAttemptsError
// ---------------------------------------------------------------------------

describe("MaxPollAttemptsError", () => {
  it("should be an instance of Error", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of IVXPError", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of MaxPollAttemptsError", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error).toBeInstanceOf(MaxPollAttemptsError);
  });

  it("should have the MAX_POLL_ATTEMPTS error code", () => {
    const error = new MaxPollAttemptsError(5);
    expect(error.code).toBe("MAX_POLL_ATTEMPTS");
  });

  it("should have the name MaxPollAttemptsError", () => {
    const error = new MaxPollAttemptsError(5);
    expect(error.name).toBe("MaxPollAttemptsError");
  });

  it("should include the attempt count in the message", () => {
    const error = new MaxPollAttemptsError(20);
    expect(error.message).toBe("Max polling attempts (20) exceeded");
  });

  it("should expose the attempts property", () => {
    const error = new MaxPollAttemptsError(15);
    expect(error.attempts).toBe(15);
  });

  it("should support error cause chain", () => {
    const cause = new Error("underlying");
    const error = new MaxPollAttemptsError(10, cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// pollWithBackoff
// ---------------------------------------------------------------------------

describe("pollWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC #3: Supports early exit on success
  // -------------------------------------------------------------------------

  describe("early exit on success", () => {
    it("should return immediately when fn returns non-null on first call", async () => {
      const fn = vi.fn().mockResolvedValue({ data: "success" });

      const result = await pollWithBackoff(fn);

      expect(result).toEqual({ data: "success" });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry until fn returns non-null", async () => {
      interceptDelays();

      const fn = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ data: "done" });

      const result = await pollWithBackoff(fn, { initialDelay: 10 });

      expect(result).toEqual({ data: "done" });
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should return the exact value fn resolves with", async () => {
      const expected = { id: "abc-123", status: "complete" };
      const fn = vi.fn().mockResolvedValue(expected);

      const result = await pollWithBackoff(fn);

      expect(result).toBe(expected);
    });

    it("should not sleep after a successful first attempt", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue("ok");
      await pollWithBackoff(fn);

      expect(delays).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AC #2: MaxPollAttemptsError thrown after max attempts
  // -------------------------------------------------------------------------

  describe("max attempts exceeded", () => {
    it("should throw MaxPollAttemptsError when max attempts are reached", async () => {
      interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      await expect(pollWithBackoff(fn, { maxAttempts: 3, initialDelay: 10 })).rejects.toThrow(
        MaxPollAttemptsError,
      );

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should include the attempt count in the error", async () => {
      interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, { maxAttempts: 5, initialDelay: 10 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MaxPollAttemptsError);
        const pollError = error as MaxPollAttemptsError;
        expect(pollError.attempts).toBe(5);
        expect(pollError.message).toBe("Max polling attempts (5) exceeded");
      }
    });

    it("should throw MaxPollAttemptsError that is catchable as IVXPError", async () => {
      interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, { maxAttempts: 2, initialDelay: 10 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        if (error instanceof IVXPError) {
          expect(error.code).toBe("MAX_POLL_ATTEMPTS");
        }
      }
    });

    it("should use default maxAttempts of 20 when not specified", async () => {
      interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, { initialDelay: 1 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MaxPollAttemptsError);
        expect((error as MaxPollAttemptsError).attempts).toBe(20);
      }

      expect(fn).toHaveBeenCalledTimes(20);
    });
  });

  // -------------------------------------------------------------------------
  // AC #1: Delay doubles each attempt with 20% jitter
  // -------------------------------------------------------------------------

  describe("exponential backoff", () => {
    it("should double the delay each attempt when jitter is 0", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 5,
          initialDelay: 100,
          jitter: 0,
        });
      } catch {
        // Expected MaxPollAttemptsError
      }

      // fn called 5 times, sleeps happen between attempts:
      // After attempt 0: sleep = min(100*2^0, 30000) = 100
      // After attempt 1: sleep = min(100*2^1, 30000) = 200
      // After attempt 2: sleep = min(100*2^2, 30000) = 400
      // After attempt 3: sleep = min(100*2^3, 30000) = 800
      // After attempt 4: throw (no sleep)
      expect(delays).toHaveLength(4);
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
      expect(delays[3]).toBe(800);
    });

    it("should cap delay at maxDelay", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 6,
          initialDelay: 1000,
          maxDelay: 3000,
          jitter: 0,
        });
      } catch {
        // Expected MaxPollAttemptsError
      }

      // After attempt 0: sleep = min(1000*2^0, 3000) = 1000
      // After attempt 1: sleep = min(1000*2^1, 3000) = 2000
      // After attempt 2: sleep = min(1000*2^2, 3000) = 3000 (capped)
      // After attempt 3: sleep = min(1000*2^3, 3000) = 3000 (capped)
      // After attempt 4: sleep = min(1000*2^4, 3000) = 3000 (capped)
      // After attempt 5: throw (no sleep)
      expect(delays).toHaveLength(5);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(3000);
      expect(delays[3]).toBe(3000);
      expect(delays[4]).toBe(3000);
    });

    it("should use default initialDelay of 1000ms", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("done");

      await pollWithBackoff(fn, { jitter: 0 });

      expect(delays).toHaveLength(1);
      expect(delays[0]).toBe(1000);
    });

    it("should use default maxDelay of 30000ms", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 20,
          initialDelay: 16000,
          jitter: 0,
        });
      } catch {
        // Expected
      }

      // After attempt 0: min(16000*2^0, 30000) = 16000
      // After attempt 1: min(16000*2^1, 30000) = 30000 (capped)
      // After attempt 2: min(16000*2^2, 30000) = 30000 (capped)
      expect(delays[0]).toBe(16000);
      expect(delays[1]).toBe(30000);
      expect(delays[2]).toBe(30000);
    });

    it("should cap first delay at maxDelay when initialDelay > maxDelay", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 3,
          initialDelay: 5000,
          maxDelay: 2000,
          jitter: 0,
        });
      } catch {
        // Expected
      }

      // After attempt 0: min(5000*2^0, 2000) = 2000 (capped immediately)
      // After attempt 1: min(5000*2^1, 2000) = 2000 (still capped)
      // After attempt 2: throw (no sleep)
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(2000);
      expect(delays[1]).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // AC #1: Jitter
  // -------------------------------------------------------------------------

  describe("jitter", () => {
    it("should apply jitter within expected range (default ±20%)", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 50,
          initialDelay: 1000,
          maxDelay: 1000, // Keep delay constant for easier analysis
        });
      } catch {
        // Expected
      }

      // All delays should be within [800, 1200] (1000 ± 20%)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(1200);
      }
    });

    it("should apply custom jitter factor", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 50,
          initialDelay: 1000,
          maxDelay: 1000,
          jitter: 0.5, // ±50%
        });
      } catch {
        // Expected
      }

      // All delays should be within [500, 1500] (1000 ± 50%)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1500);
      }
    });

    it("should produce varying delays with controlled randomness", async () => {
      // Mock Math.random to produce a known alternating sequence
      // that guarantees distinct jittered values.
      let callIndex = 0;
      const randomValues = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.0];
      vi.spyOn(Math, "random").mockImplementation(() => {
        const value = randomValues[callIndex % randomValues.length];
        callIndex++;
        return value;
      });

      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 6,
          initialDelay: 1000,
          maxDelay: 1000, // Keep constant to isolate jitter effect
        });
      } catch {
        // Expected
      }

      // With our mocked sequence, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it("should not apply jitter when jitter is 0", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 5,
          initialDelay: 500,
          maxDelay: 500,
          jitter: 0,
        });
      } catch {
        // Expected
      }

      // All delays should be exactly 500
      for (const delay of delays) {
        expect(delay).toBe(500);
      }
    });

    it("should clamp negative jittered delays to 0", async () => {
      // Mock Math.random to return 0 (minimum jitter factor)
      // With jitter=1.0 and random=0, factor = 1 + (0*2-1)*1 = 0
      // So delay = baseDelay * 0 = 0
      vi.spyOn(Math, "random").mockReturnValue(0);

      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 3,
          initialDelay: 100,
          jitter: 1.0,
        });
      } catch {
        // Expected
      }

      // All delays should be clamped to 0 (not negative)
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC #4: Configurable parameters
  // -------------------------------------------------------------------------

  describe("configurable parameters", () => {
    it("should accept all options as optional (defaults work)", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      const result = await pollWithBackoff(fn);

      expect(result).toBe("result");
    });

    it("should accept custom initialDelay", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("ok");

      await pollWithBackoff(fn, { initialDelay: 50, jitter: 0 });

      expect(delays[0]).toBe(50);
    });

    it("should accept custom maxDelay", async () => {
      const delays = interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, {
          maxAttempts: 4,
          initialDelay: 500,
          maxDelay: 500,
          jitter: 0,
        });
      } catch {
        // Expected
      }

      // All delays capped at 500
      for (const delay of delays) {
        expect(delay).toBe(500);
      }
    });

    it("should accept custom maxAttempts", async () => {
      interceptDelays();

      const fn = vi.fn().mockResolvedValue(null);

      try {
        await pollWithBackoff(fn, { maxAttempts: 7, initialDelay: 1 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as MaxPollAttemptsError).attempts).toBe(7);
      }

      expect(fn).toHaveBeenCalledTimes(7);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should throw IVXPError when initialDelay is 0", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { initialDelay: 0 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
        expect((error as IVXPError).message).toContain("initialDelay");
      }

      expect(fn).not.toHaveBeenCalled();
    });

    it("should throw IVXPError when initialDelay is negative", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { initialDelay: -100 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
      }

      expect(fn).not.toHaveBeenCalled();
    });

    it("should throw IVXPError when maxDelay is 0", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { maxDelay: 0 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
        expect((error as IVXPError).message).toContain("maxDelay");
      }
    });

    it("should throw IVXPError when maxDelay is negative", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { maxDelay: -500 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
      }
    });

    it("should throw IVXPError when maxAttempts is 0", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { maxAttempts: 0 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
        expect((error as IVXPError).message).toContain("maxAttempts");
      }
    });

    it("should throw IVXPError when maxAttempts is negative", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { maxAttempts: -1 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
      }
    });

    it("should throw IVXPError when jitter is negative", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { jitter: -0.1 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
        expect((error as IVXPError).message).toContain("jitter");
      }
    });

    it("should throw IVXPError when jitter exceeds 1", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { jitter: 1.5 });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_POLL_OPTIONS");
        expect((error as IVXPError).message).toContain("jitter");
      }
    });

    it("should accept jitter of exactly 0", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      const result = await pollWithBackoff(fn, { jitter: 0 });

      expect(result).toBe("ok");
    });

    it("should accept jitter of exactly 1", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const fn = vi.fn().mockResolvedValue("ok");

      const result = await pollWithBackoff(fn, { jitter: 1 });

      expect(result).toBe("ok");
    });

    it("should not call fn when validation fails", async () => {
      const fn = vi.fn().mockResolvedValue("ok");

      try {
        await pollWithBackoff(fn, { initialDelay: -1 });
      } catch {
        // Expected
      }

      expect(fn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Abort signal support
  // -------------------------------------------------------------------------

  describe("abort signal", () => {
    it("should abort immediately when signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const fn = vi.fn().mockResolvedValue(null);

      await expect(pollWithBackoff(fn, { signal: controller.signal })).rejects.toThrow(
        "Polling aborted",
      );

      expect(fn).not.toHaveBeenCalled();
    });

    it("should abort between poll attempts", async () => {
      const controller = new AbortController();

      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          controller.abort();
        }
        return null;
      });

      // Use interceptDelays so sleep resolves instantly,
      // but the abort check before attempt 3 should catch it
      interceptDelays();

      await expect(
        pollWithBackoff(fn, {
          initialDelay: 10,
          signal: controller.signal,
        }),
      ).rejects.toThrow("Polling aborted");

      // fn called twice: first returns null, second aborts, third never called
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should abort during sleep", async () => {
      const controller = new AbortController();

      const fn = vi.fn().mockResolvedValue(null);

      // Don't intercept delays -- let real setTimeout be used with fake timers
      const promise = pollWithBackoff(fn, {
        initialDelay: 5000,
        signal: controller.signal,
      });

      // Advance past first fn call, then abort during sleep
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();

      await expect(promise).rejects.toThrow("Sleep aborted");
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation from polled function
  // -------------------------------------------------------------------------

  describe("error propagation", () => {
    it("should propagate errors thrown by the polled function", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fn failed"));

      await expect(pollWithBackoff(fn)).rejects.toThrow("fn failed");

      // Should not retry on errors -- only on null returns
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should propagate IVXPError subclass from polled function", async () => {
      const fn = vi.fn().mockRejectedValue(new MaxPollAttemptsError(99));

      try {
        await pollWithBackoff(fn);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MaxPollAttemptsError);
        expect((error as MaxPollAttemptsError).attempts).toBe(99);
      }
    });

    it("should propagate error after several null returns", async () => {
      interceptDelays();

      const fn = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("third call failed"));

      await expect(pollWithBackoff(fn, { initialDelay: 10 })).rejects.toThrow("third call failed");

      // Two null returns + one throw = 3 calls total, no retry after error
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});

// ---------------------------------------------------------------------------
// pollOrderStatus
// ---------------------------------------------------------------------------

describe("pollOrderStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should return when status matches a target status", async () => {
    const getStatus = vi.fn().mockResolvedValue({ status: "completed" });

    const result = await pollOrderStatus(getStatus, ["completed", "failed"]);

    expect(result).toEqual({ status: "completed" });
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("should poll until status matches", async () => {
    interceptDelays();

    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({ status: "completed" });

    const result = await pollOrderStatus(getStatus, ["completed", "failed"], { initialDelay: 10 });

    expect(result).toEqual({ status: "completed" });
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it("should return null-returning getStatus results as continued polling", async () => {
    interceptDelays();

    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "completed" });

    const result = await pollOrderStatus(getStatus, ["completed"], { initialDelay: 10 });

    expect(result).toEqual({ status: "completed" });
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it("should throw MaxPollAttemptsError when status never matches", async () => {
    interceptDelays();

    const getStatus = vi.fn().mockResolvedValue({ status: "pending" });

    await expect(
      pollOrderStatus(getStatus, ["completed"], {
        maxAttempts: 3,
        initialDelay: 10,
      }),
    ).rejects.toThrow(MaxPollAttemptsError);

    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it("should pass polling options through to pollWithBackoff", async () => {
    const delays = interceptDelays();

    const getStatus = vi.fn().mockResolvedValue({ status: "pending" });

    try {
      await pollOrderStatus(getStatus, ["completed"], {
        maxAttempts: 3,
        initialDelay: 200,
        jitter: 0,
      });
    } catch {
      // Expected
    }

    expect(delays[0]).toBe(200);
    expect(delays[1]).toBe(400);
  });
});
