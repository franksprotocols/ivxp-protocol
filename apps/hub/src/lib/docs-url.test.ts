import { describe, expect, it } from "vitest";
import { getDocsUrl } from "./docs-url";

describe("getDocsUrl", () => {
  it("uses configured docs URL and appends spec entry path when path is root", () => {
    expect(
      getDocsUrl({
        NEXT_PUBLIC_DOCS_URL: "https://docs.example.com",
        NODE_ENV: "development",
      }),
    ).toBe("https://docs.example.com/docs/ivxp-protocol-specification/1-what-is-ivxp");
  });

  it("keeps configured docs URL path when already specified", () => {
    expect(
      getDocsUrl({
        NEXT_PUBLIC_DOCS_URL: "https://docs.example.com/custom/path",
        NODE_ENV: "development",
      }),
    ).toBe("https://docs.example.com/custom/path");
  });

  it("defaults to localhost in development", () => {
    expect(getDocsUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:3001/docs/ivxp-protocol-specification/1-what-is-ivxp",
    );
  });

  it("defaults to Vercel URL in production", () => {
    expect(getDocsUrl({ NODE_ENV: "production" })).toBe(
      "https://ivxp-docs.vercel.app/docs/ivxp-protocol-specification/1-what-is-ivxp",
    );
  });

  it("defaults to Vercel URL in test environment", () => {
    expect(getDocsUrl({ NODE_ENV: "test" })).toBe(
      "https://ivxp-docs.vercel.app/docs/ivxp-protocol-specification/1-what-is-ivxp",
    );
  });
});
