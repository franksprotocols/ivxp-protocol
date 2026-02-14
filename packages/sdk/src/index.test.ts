import { describe, it, expect } from "vitest";

describe("@ivxp/sdk", () => {
  it("should be importable", async () => {
    const mod = await import("./index.js");
    expect(mod).toBeDefined();
  });
});
