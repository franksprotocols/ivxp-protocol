import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyRegistrationSignature, buildRegistrationMessage } from "./verify-signature";

// Anvil test account #0
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("buildRegistrationMessage", () => {
  it("builds canonical message format", () => {
    const message = buildRegistrationMessage({
      providerAddress: TEST_ADDRESS,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: "2026-02-09T12:00:00.000Z",
    });

    expect(message).toContain("IVXP Provider Registration");
    expect(message).toContain(`Address: ${TEST_ADDRESS}`);
    expect(message).toContain("Name: Test Provider");
    expect(message).toContain("Endpoint: https://test.example.com");
    expect(message).toContain("Timestamp: 2026-02-09T12:00:00.000Z");
  });
});

describe("verifyRegistrationSignature", () => {
  it("returns true for valid signature matching address", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: new Date().toISOString(),
    });

    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address,
    });

    expect(result).toBe(true);
  });

  it("returns false when signer does not match expected address", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: new Date().toISOString(),
    });
    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: "0x0000000000000000000000000000000000000001",
    });

    expect(result).toBe(false);
  });

  it("returns false for malformed signature", async () => {
    const message = buildRegistrationMessage({
      providerAddress: TEST_ADDRESS,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: new Date().toISOString(),
    });

    const result = await verifyRegistrationSignature({
      message,
      signature: "0xinvalid" as `0x${string}`,
      expectedAddress: TEST_ADDRESS as `0x${string}`,
    });

    expect(result).toBe(false);
  });

  it("handles case-insensitive address comparison", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: new Date().toISOString(),
    });
    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address.toLowerCase() as `0x${string}`,
    });

    expect(result).toBe(true);
  });

  it("returns false for expired timestamp (older than 5 minutes)", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: oldTimestamp,
    });

    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address,
    });

    expect(result).toBe(false);
  });

  it("returns false for future timestamp (more than 5 minutes ahead)", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const futureTimestamp = new Date(Date.now() + 6 * 60 * 1000).toISOString(); // 6 minutes ahead
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: futureTimestamp,
    });

    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address,
    });

    expect(result).toBe(false);
  });

  it("returns false for missing timestamp", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const message = "IVXP Provider Registration\nAddress: " + account.address;
    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address,
    });

    expect(result).toBe(false);
  });

  it("returns false for invalid timestamp format", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const message = buildRegistrationMessage({
      providerAddress: account.address,
      name: "Test Provider",
      endpointUrl: "https://test.example.com",
      timestamp: "not-a-date",
    });

    const signature = await account.signMessage({ message });

    const result = await verifyRegistrationSignature({
      message,
      signature,
      expectedAddress: account.address,
    });

    expect(result).toBe(false);
  });
});
