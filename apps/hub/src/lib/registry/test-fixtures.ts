import type { RegistryProviderWire } from "./types";

/**
 * Shared test fixtures for registry tests.
 * Use these instead of duplicating mock data across test files.
 */

export const mockProviders: RegistryProviderWire[] = [
  {
    provider_id: "prov-001",
    provider_address: "0xAAA",
    name: "Alpha Provider",
    description: "First test provider",
    endpoint_url: "https://alpha.example.com",
    services: [
      {
        service_type: "text_echo",
        name: "Text Echo",
        description: "Echoes text",
        price_usdc: "0.10",
        estimated_time_seconds: 5,
      },
    ],
    status: "active",
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    provider_id: "prov-002",
    provider_address: "0xBBB",
    name: "Beta Research",
    description: "Research and analysis",
    endpoint_url: "https://beta.example.com",
    services: [
      {
        service_type: "research",
        name: "Deep Research",
        description: "Comprehensive research",
        price_usdc: "50.00",
        estimated_time_seconds: 28800,
      },
      {
        service_type: "code_review",
        name: "Code Review",
        description: "Detailed code review",
        price_usdc: "50.00",
        estimated_time_seconds: 43200,
      },
    ],
    status: "active",
    registered_at: "2025-02-01T00:00:00Z",
    updated_at: "2025-02-01T00:00:00Z",
  },
  {
    provider_id: "prov-003",
    provider_address: "0xCCC",
    name: "Gamma Offline",
    description: "Currently offline provider",
    endpoint_url: "https://gamma.example.com",
    services: [
      {
        service_type: "consultation",
        name: "Consultation",
        description: "General consultation",
        price_usdc: "25.00",
        estimated_time_seconds: 7200,
      },
    ],
    status: "inactive",
    registered_at: "2025-01-20T00:00:00Z",
    updated_at: "2025-03-01T00:00:00Z",
  },
];
