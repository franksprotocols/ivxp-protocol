import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RegistryProviderWire } from "./types";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockRenameSync = vi.fn();
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockUnlinkSync = vi.fn();
const mockClearProviderCache = vi.fn();
const mockLockRelease = vi.fn().mockResolvedValue(undefined);
const mockLock = vi.fn().mockResolvedValue(mockLockRelease);

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...actual,
      readFileSync: mockReadFileSync,
      writeFileSync: mockWriteFileSync,
      renameSync: mockRenameSync,
      existsSync: mockExistsSync,
      unlinkSync: mockUnlinkSync,
    },
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    renameSync: mockRenameSync,
    existsSync: mockExistsSync,
    unlinkSync: mockUnlinkSync,
  };
});

vi.mock("proper-lockfile", () => ({
  lock: (...args: unknown[]) => mockLock(...args),
}));

vi.mock("./loader", () => ({
  clearProviderCache: (...args: unknown[]) => mockClearProviderCache(...args),
}));

const { isProviderRegistered, generateProviderId, updateProviderVerifications } =
  await import("./writer");

const mockProviders: RegistryProviderWire[] = [
  {
    provider_id: "prov-001",
    provider_address: "0xAAA111BBB222CCC333DDD444EEE555FFF666AAA1",
    name: "Existing Provider",
    description: "Already registered",
    endpoint_url: "https://existing.example.com",
    services: [],
    status: "active",
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    verification_status: "pending",
    last_verified_at: null,
    last_check_at: null,
    consecutive_failures: 0,
  },
];

describe("isProviderRegistered", () => {
  it("returns true when provider_address exists (exact match)", () => {
    expect(isProviderRegistered(mockProviders, "0xAAA111BBB222CCC333DDD444EEE555FFF666AAA1")).toBe(
      true,
    );
  });

  it("returns true for case-insensitive match", () => {
    expect(isProviderRegistered(mockProviders, "0xaaa111bbb222ccc333ddd444eee555fff666aaa1")).toBe(
      true,
    );
  });

  it("returns false when provider_address does not exist", () => {
    expect(isProviderRegistered(mockProviders, "0x0000000000000000000000000000000000000001")).toBe(
      false,
    );
  });
});

describe("generateProviderId", () => {
  it("generates a string starting with prov-", () => {
    const id = generateProviderId();
    expect(id).toMatch(/^prov-[a-f0-9-]+$/);
  });

  it("generates unique IDs", () => {
    const id1 = generateProviderId();
    const id2 = generateProviderId();
    expect(id1).not.toBe(id2);
  });
});

describe("updateProviderVerifications", () => {
  const registryData = {
    providers: [
      {
        provider_id: "prov-001",
        provider_address: "0xAAA",
        name: "Test Provider",
        description: "Test",
        endpoint_url: "https://test.example.com",
        services: [],
        status: "active",
        registered_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        verification_status: "pending",
        last_verified_at: null,
        last_check_at: null,
        consecutive_failures: 0,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFileSync.mockReturnValue(JSON.stringify(registryData));
  });

  it("updates provider verification fields atomically", async () => {
    const updates = new Map<string, Partial<RegistryProviderWire>>();
    updates.set("prov-001", {
      verification_status: "verified",
      last_verified_at: "2025-06-15T10:30:00Z",
      last_check_at: "2025-06-15T10:30:00Z",
      consecutive_failures: 0,
    });

    await updateProviderVerifications(updates);

    expect(mockLock).toHaveBeenCalledOnce();
    expect(mockLockRelease).toHaveBeenCalledOnce();
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.providers[0].verification_status).toBe("verified");
    expect(parsed.providers[0].last_verified_at).toBe("2025-06-15T10:30:00Z");
    expect(parsed.providers[0].consecutive_failures).toBe(0);
  });

  it("writes to temp file then renames (atomic write)", async () => {
    const updates = new Map<string, Partial<RegistryProviderWire>>();
    updates.set("prov-001", { verification_status: "verified" });

    await updateProviderVerifications(updates);

    const tmpPath = mockWriteFileSync.mock.calls[0][0] as string;
    const renamedFrom = mockRenameSync.mock.calls[0][0] as string;
    const renamedTo = mockRenameSync.mock.calls[0][1] as string;

    expect(tmpPath).toContain(".tmp");
    expect(renamedFrom).toContain(".tmp");
    expect(renamedTo).toContain("providers.json");
    expect(renamedTo).not.toContain(".tmp");
  });

  it("invalidates cache after write", async () => {
    const updates = new Map<string, Partial<RegistryProviderWire>>();
    updates.set("prov-001", { verification_status: "verified" });

    await updateProviderVerifications(updates);

    expect(mockClearProviderCache).toHaveBeenCalledOnce();
  });

  it("does not modify providers without updates", async () => {
    const updates = new Map<string, Partial<RegistryProviderWire>>();
    updates.set("prov-999", { verification_status: "verified" });

    await updateProviderVerifications(updates);

    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenContent);
    expect(parsed.providers[0].verification_status).toBe("pending");
  });
});
