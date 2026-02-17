// Wire-format types (snake_case for JSON serialization)

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
