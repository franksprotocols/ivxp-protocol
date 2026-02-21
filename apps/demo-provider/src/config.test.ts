/**
 * Unit tests for the configuration loader.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const VALID_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should load valid configuration from environment", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("PORT", "4000");
    vi.stubEnv("NETWORK", "base-sepolia");

    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.privateKey).toBe(VALID_KEY);
    expect(config.network).toBe("base-sepolia");
    expect(config.providerName).toBe("IVXP Demo Provider");
  });

  it("should use defaults when optional vars are missing", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);

    const config = loadConfig();

    expect(config.port).toBe(3001);
    expect(config.logLevel).toBe("info");
    expect(config.network).toBe("base-sepolia");
    expect(config.corsAllowedOrigins).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://ivxp-protocol.vercel.app",
    ]);
    expect(config.rateLimitMax).toBe(100);
    expect(config.rateLimitWindowMs).toBe(60_000);
  });

  it("should throw for missing private key", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", "");

    expect(() => loadConfig()).toThrow("Configuration errors");
  });

  it("should throw for invalid private key format", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", "not-a-key");

    expect(() => loadConfig()).toThrow("PROVIDER_PRIVATE_KEY");
  });

  it("should throw for invalid port", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("PORT", "99999");

    expect(() => loadConfig()).toThrow("PORT");
  });

  it("should parse comma-separated CORS origins", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://a.com, http://b.com");

    const config = loadConfig();
    expect(config.corsAllowedOrigins).toEqual(["http://a.com", "http://b.com"]);
  });

  it("should normalize CORS origins with trailing slashes and dedupe entries", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv(
      "CORS_ALLOWED_ORIGINS",
      "https://ivxp-protocol.vercel.app/, https://ivxp-protocol.vercel.app",
    );

    const config = loadConfig();
    expect(config.corsAllowedOrigins).toEqual(["https://ivxp-protocol.vercel.app"]);
  });

  it("should accept custom rate limit values", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("RATE_LIMIT_MAX", "50");
    vi.stubEnv("RATE_LIMIT_WINDOW_MS", "30000");

    const config = loadConfig();
    expect(config.rateLimitMax).toBe(50);
    expect(config.rateLimitWindowMs).toBe(30_000);
  });

  it("should throw for invalid RATE_LIMIT_MAX", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("RATE_LIMIT_MAX", "0");

    expect(() => loadConfig()).toThrow("RATE_LIMIT_MAX");
  });

  it("should throw for RATE_LIMIT_WINDOW_MS below minimum", () => {
    vi.stubEnv("PROVIDER_PRIVATE_KEY", VALID_KEY);
    vi.stubEnv("RATE_LIMIT_WINDOW_MS", "500");

    expect(() => loadConfig()).toThrow("RATE_LIMIT_WINDOW_MS");
  });
});
