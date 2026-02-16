import type { Address } from "viem";

export interface Service {
  readonly service_type: string;
  readonly description: string;
  readonly price_usdc: string;
  readonly provider_address: Address;
  readonly provider_name?: string;
  readonly category?: string;
}

export interface ServiceCatalog {
  readonly services: readonly Service[];
  readonly provider_address: Address;
}

export const SERVICE_CATEGORIES = ["All", "AI", "Data", "Compute", "Demo"] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
