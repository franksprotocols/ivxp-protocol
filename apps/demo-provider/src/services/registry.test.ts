/**
 * Unit tests for the service registry.
 *
 * Validates:
 * - Service handler lookup by type
 * - Unknown service type returns undefined
 * - All expected service types are registered
 */

import { describe, expect, it } from "vitest";
import { getServiceHandler, getRegisteredServiceTypes } from "./index.js";

describe("service registry", () => {
  it("should return a handler for text_echo", () => {
    const handler = getServiceHandler("text_echo");
    expect(handler).toBeTypeOf("function");
  });

  it("should return a handler for image_gen", () => {
    const handler = getServiceHandler("image_gen");
    expect(handler).toBeTypeOf("function");
  });

  it("should return undefined for unknown service type", () => {
    const handler = getServiceHandler("nonexistent_service");
    expect(handler).toBeUndefined();
  });

  it("should list all registered service types", () => {
    const types = getRegisteredServiceTypes();
    expect(types).toContain("text_echo");
    expect(types).toContain("image_gen");
    expect(types).toHaveLength(2);
  });
});
