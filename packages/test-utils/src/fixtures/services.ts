/**
 * Service fixture factories for testing.
 *
 * Provides factory functions that create valid protocol service objects
 * with sensible defaults. All fields can be overridden via partial objects.
 */

import type {
  ClientAgent,
  ServiceCatalog,
  ServiceDefinition,
  ServiceRequest,
  ServiceRequestDetails,
} from "@ivxp/protocol";

import { TEST_ACCOUNTS } from "./wallets.js";

// ---------------------------------------------------------------------------
// ServiceDefinition factory
// ---------------------------------------------------------------------------

/**
 * Create a mock ServiceDefinition with optional field overrides.
 */
export const createMockServiceDefinition = (
  overrides?: Partial<ServiceDefinition>,
): ServiceDefinition => ({
  type: "code_review",
  base_price_usdc: 10,
  estimated_delivery_hours: 1,
  ...overrides,
});

// ---------------------------------------------------------------------------
// ServiceCatalog factory
// ---------------------------------------------------------------------------

/**
 * Default service definitions used in mock catalogs.
 */
export const DEFAULT_SERVICE_DEFINITIONS: readonly ServiceDefinition[] = [
  {
    type: "code_review",
    base_price_usdc: 10,
    estimated_delivery_hours: 1,
  },
  {
    type: "translation",
    base_price_usdc: 25,
    estimated_delivery_hours: 2,
  },
  {
    type: "research_report",
    base_price_usdc: 50,
    estimated_delivery_hours: 4,
  },
] as const;

/**
 * Create a mock ServiceCatalog with optional field overrides.
 */
export const createMockServiceCatalog = (overrides?: Partial<ServiceCatalog>): ServiceCatalog => ({
  protocol: "IVXP/1.0",
  provider: "TestProvider",
  wallet_address: TEST_ACCOUNTS.provider.address,
  services: DEFAULT_SERVICE_DEFINITIONS,
  message_type: "service_catalog",
  timestamp: new Date().toISOString(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// ClientAgent factory
// ---------------------------------------------------------------------------

/**
 * Create a mock ClientAgent with optional field overrides.
 */
export const createMockClientAgent = (overrides?: Partial<ClientAgent>): ClientAgent => ({
  name: "TestClient",
  wallet_address: TEST_ACCOUNTS.client.address,
  ...overrides,
});

// ---------------------------------------------------------------------------
// ServiceRequestDetails factory
// ---------------------------------------------------------------------------

/**
 * Create a mock ServiceRequestDetails with optional field overrides.
 */
export const createMockServiceRequestDetails = (
  overrides?: Partial<ServiceRequestDetails>,
): ServiceRequestDetails => ({
  type: "code_review",
  description: "Please review this pull request for code quality issues.",
  budget_usdc: 15,
  delivery_format: "markdown",
  ...overrides,
});

// ---------------------------------------------------------------------------
// ServiceRequest factory
// ---------------------------------------------------------------------------

/**
 * Create a mock ServiceRequest with optional field overrides.
 */
export const createMockServiceRequest = (overrides?: Partial<ServiceRequest>): ServiceRequest => ({
  protocol: "IVXP/1.0",
  message_type: "service_request",
  timestamp: new Date().toISOString(),
  client_agent: createMockClientAgent(overrides?.client_agent),
  service_request: createMockServiceRequestDetails(overrides?.service_request),
  ...overrides,
});
