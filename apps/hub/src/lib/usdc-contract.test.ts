import { afterEach, describe, expect, it, vi } from "vitest";
import { base, baseSepolia } from "wagmi/chains";

const ORIGINAL_ENV = { ...process.env };

async function loadModule() {
  vi.resetModules();
  return import("./usdc-contract");
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("usdc-contract", () => {
  it("uses Base Sepolia USDC by default in development", async () => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_USDC_ADDRESS;
    delete process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA;

    const { getUsdcAddress } = await loadModule();
    expect(getUsdcAddress(baseSepolia.id)).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  });

  it("uses Base mainnet USDC by default in production", async () => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_USDC_ADDRESS;
    delete process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_MAINNET;

    const { getUsdcAddress } = await loadModule();
    expect(getUsdcAddress(base.id)).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  });

  it("prefers global NEXT_PUBLIC_USDC_ADDRESS override", async () => {
    setNodeEnv("development");
    process.env.NEXT_PUBLIC_USDC_ADDRESS = "0x1111111111111111111111111111111111111111";

    const { getUsdcAddress } = await loadModule();
    expect(getUsdcAddress(baseSepolia.id)).toBe("0x1111111111111111111111111111111111111111");
    expect(getUsdcAddress(base.id)).toBe("0x1111111111111111111111111111111111111111");
  });

  it("uses chain-specific override when global override is absent", async () => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_USDC_ADDRESS;
    process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA =
      "0x2222222222222222222222222222222222222222";

    const { getUsdcAddress } = await loadModule();
    expect(getUsdcAddress(baseSepolia.id)).toBe("0x2222222222222222222222222222222222222222");
  });
});
