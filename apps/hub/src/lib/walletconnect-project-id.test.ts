import { describe, expect, it } from "vitest";
import { isValidWalletConnectProjectId } from "./walletconnect-project-id";

describe("isValidWalletConnectProjectId", () => {
  it("returns false for empty and placeholder values", () => {
    expect(isValidWalletConnectProjectId(undefined)).toBe(false);
    expect(isValidWalletConnectProjectId("")).toBe(false);
    expect(isValidWalletConnectProjectId("   ")).toBe(false);
    expect(isValidWalletConnectProjectId("your_project_id")).toBe(false);
    expect(isValidWalletConnectProjectId("YOUR-PROJECT-ID")).toBe(false);
    expect(isValidWalletConnectProjectId("replace_me")).toBe(false);
    expect(isValidWalletConnectProjectId("changeme")).toBe(false);
  });

  it("returns true for real ids", () => {
    expect(isValidWalletConnectProjectId("abc123def456")).toBe(true);
  });
});
