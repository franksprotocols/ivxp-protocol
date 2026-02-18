import type { Address } from "viem";

export interface Service {
  readonly service_type: string;
  readonly description: string;
  readonly price_usdc: string;
  readonly provider_address: Address;
  readonly provider_id?: string;
  readonly provider_endpoint_url?: string;
  readonly provider_name?: string;
  readonly category?: string;
}

export interface SchemaProperty {
  readonly type: string;
  readonly description: string;
  readonly required?: boolean;
  readonly example?: unknown;
  readonly enum?: readonly string[];
  readonly maxLength?: number;
}

export interface InputSchema {
  readonly type: string;
  readonly properties: Readonly<Record<string, SchemaProperty>>;
  readonly required?: readonly string[];
}

export interface OutputSchema {
  readonly type: string;
  readonly format?: string;
  readonly example?: string;
}

export interface ServiceExample {
  readonly input: unknown;
  readonly output: unknown;
  readonly description?: string;
}

export interface ServiceDetail extends Service {
  readonly long_description?: string;
  readonly provider_reputation?: number;
  readonly provider_id?: string;
  readonly provider_endpoint_url?: string;
  readonly provider_url?: string;
  readonly input_schema: InputSchema;
  readonly output_schema: OutputSchema;
  readonly tags?: readonly string[];
  readonly estimated_time?: string;
  readonly examples?: readonly ServiceExample[];
}

export interface ServiceCatalog {
  readonly services: readonly Service[];
  readonly provider_address: Address;
}

export const SERVICE_CATEGORIES = ["All", "AI", "Data", "Compute", "Demo"] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
