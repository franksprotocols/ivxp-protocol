import { describe, expect, it } from "vitest";
import { getDocsUrl } from "./docs-url";

describe("getDocsUrl", () => {
  it("returns NEXT_PUBLIC_DOCS_URL when provided", () => {
    expect(
      getDocsUrl({
        NEXT_PUBLIC_DOCS_URL: "https://docs.example.com",
        NODE_ENV: "development",
      }),
    ).toBe("https://docs.example.com");
  });

  it("defaults to localhost in development", () => {
    expect(getDocsUrl({ NODE_ENV: "development" })).toBe("http://localhost:3001");
  });

  it("defaults to Vercel URL in production", () => {
    expect(getDocsUrl({ NODE_ENV: "production" })).toBe("https://ivxp-docs.vercel.app");
  });

  it("defaults to Vercel URL in test environment", () => {
    expect(getDocsUrl({ NODE_ENV: "test" })).toBe("https://ivxp-docs.vercel.app");
  });
});
