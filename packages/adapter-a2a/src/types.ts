import type { NetworkType } from '@ivxp/sdk';

export interface A2AAdapterConfig {
  /** EIP-191 private key for signing — load from IVXP_PRIVATE_KEY env var */
  privateKey: `0x${string}`;
  /** Base network to use (default: 'base-sepolia') */
  network?: NetworkType;
  /** Provider URL for client-side requests — load from IVXP_PROVIDER_URL env var */
  providerUrl?: string;
}
