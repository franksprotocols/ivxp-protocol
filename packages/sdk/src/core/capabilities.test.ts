/**
 * Unit tests for provider capability detection utilities.
 */

import { describe, it, expect } from "vitest";
import { hasCapability, CAPABILITY_SSE } from "./capabilities.js";
import type { ServiceCatalogOutput } from "@ivxp/protocol";

const baseCatalog: ServiceCatalogOutput = {
  protocol: "IVXP/1.0",
  provider: "Test",
  walletAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
  services: [],
};

describe("hasCapability", () => {
  it("returns true when capability is present", () => {
    const catalog = { ...baseCatalog, capabilities: ["sse"] };
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(true);
  });

  it("returns false when capability is absent from list", () => {
    const catalog = { ...baseCatalog, capabilities: ["other"] };
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(false);
  });

  it("returns false when capabilities field is missing", () => {
    expect(hasCapability(baseCatalog, CAPABILITY_SSE)).toBe(false);
  });

  it("returns false for unknown future capability not in list", () => {
    const catalog = { ...baseCatalog, capabilities: ["sse", "unknown_future"] };
    expect(hasCapability(catalog, "not_present")).toBe(false);
  });

  it("returns true for unknown future capability that is present", () => {
    const catalog = { ...baseCatalog, capabilities: ["sse", "unknown_future"] };
    expect(hasCapability(catalog, "unknown_future")).toBe(true);
  });

  it("returns false when capabilities is an empty array", () => {
    const catalog = { ...baseCatalog, capabilities: [] };
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(false);
  });
});
