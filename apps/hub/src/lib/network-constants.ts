import { base, baseSepolia } from "wagmi/chains";

export const SUPPORTED_CHAIN_IDS = [base.id, baseSepolia.id] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getTargetChain() {
  return process.env.NODE_ENV === "production" ? base : baseSepolia;
}

export const UNKNOWN_CHAIN_NAME = "Unknown";

export function getChainName(chainId: number): string {
  if (chainId === base.id) return base.name;
  if (chainId === baseSepolia.id) return baseSepolia.name;
  return UNKNOWN_CHAIN_NAME;
}
