export const DEMO_PROVIDER_URL =
  process.env.NEXT_PUBLIC_DEMO_PROVIDER_URL ?? "http://localhost:3001";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const FAUCET_LINKS = {
  ethAlchemy: "https://www.alchemy.com/faucets/base-sepolia",
  usdcCircle: "https://faucet.circle.com",
} as const;

export const PLAYGROUND_STEPS = [
  "Connect your wallet (MetaMask or Rainbow)",
  "Switch to Base Sepolia network",
  "Get testnet ETH and USDC from faucets below",
  "Run simulated protocol events in this playground",
  "Use Marketplace for the real quote -> pay -> sign -> status -> download flow",
] as const;
