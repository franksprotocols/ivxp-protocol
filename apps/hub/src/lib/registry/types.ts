// Wire-format types (snake_case for JSON serialization)

/** Verification status for a registered provider */
export type VerificationStatus = "verified" | "unresponsive" | "pending";

/** A single service offered by a provider */
export interface ProviderServiceWire {
  service_type: string;
  name: string;
  description: string;
  price_usdc: string;
  estimated_time_seconds: number;
}

/** A registered provider in the registry */
export interface RegistryProviderWire {
  provider_id: string;
  provider_address: string;
  name: string;
  description: string;
  endpoint_url: string;
  services: ProviderServiceWire[];
  status: "active" | "inactive";
  registered_at: string;
  updated_at: string;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  last_check_at: string | null;
  consecutive_failures: number;
}

/** Paginated response for listing providers */
export interface ListProvidersResponseWire {
  providers: RegistryProviderWire[];
  total: number;
  page: number;
  page_size: number;
}

/** Error response format */
export interface RegistryErrorResponseWire {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/** Registration request body sent by the provider owner */
export interface RegisterProviderRequestWire {
  provider_address: string;
  name: string;
  description: string;
  endpoint_url: string;
  services: ProviderServiceWire[];
  signature: string;
  message: string;
}

/** Successful registration response */
export interface RegisterProviderResponseWire {
  provider: RegistryProviderWire;
}

// Internal types (camelCase for TypeScript code)

export interface ProviderService {
  serviceType: string;
  name: string;
  description: string;
  priceUsdc: string;
  estimatedTimeSeconds: number;
}

export interface RegistryProvider {
  providerId: string;
  providerAddress: string;
  name: string;
  description: string;
  endpointUrl: string;
  services: ProviderService[];
  status: "active" | "inactive";
  registeredAt: string;
  updatedAt: string;
}

/** Result of verifying a single provider (wire format) */
export interface VerificationResultWire {
  provider_id: string;
  provider_address: string;
  name: string;
  previous_status: VerificationStatus;
  new_status: VerificationStatus;
  reachable: boolean;
  response_time_ms: number | null;
  error: string | null;
  error_code: string | null;
  checked_at: string;
}

/** Summary response for bulk verification (wire format) */
export interface VerificationSummaryWire {
  total_checked: number;
  verified_count: number;
  unresponsive_count: number;
  grace_period_count: number;
  results: VerificationResultWire[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

/** Result of verifying a single provider (internal) */
export interface VerificationResult {
  providerId: string;
  providerAddress: string;
  name: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  reachable: boolean;
  responseTimeMs: number | null;
  error: string | null;
  errorCode: string | null;
  checkedAt: string;
}
