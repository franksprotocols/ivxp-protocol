export const DEMO_PROVIDER_URL =
  process.env.NEXT_PUBLIC_DEMO_PROVIDER_URL ?? "https://demo-provider.railway.app";

export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const FAUCET_LINKS = {
  ethAlchemy: "https://www.alchemy.com/faucets/base-sepolia",
  usdcCircle: "https://faucet.circle.com",
} as const;

export const PLAYGROUND_STEPS = [
  "Connect your wallet (MetaMask or Rainbow)",
  "Switch to Base Sepolia network",
  "Get testnet ETH and USDC from faucets below",
  "Select a demo service to test",
  "Watch the Protocol Inspector to see IVXP in action",
] as const;
