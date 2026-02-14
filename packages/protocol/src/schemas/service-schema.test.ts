/**
 * Unit tests for service Zod schemas.
 */

import { describe, expect, it } from "vitest";

import {
  ClientAgentSchema,
  ServiceCatalogSchema,
  ServiceDefinitionSchema,
  ServiceRequestDetailsSchema,
  ServiceRequestSchema,
} from "./service-schema.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const VALID_TIMESTAMP = "2026-02-05T12:00:00Z";

// ============================================================================
// ServiceDefinitionSchema
// ============================================================================

describe("ServiceDefinitionSchema", () => {
  it("should parse valid service definition with camelCase transform", () => {
    const result = ServiceDefinitionSchema.parse({
      type: "code_review",
      base_price_usdc: 30,
      estimated_delivery_hours: 1,
    });

    expect(result.type).toBe("code_review");
    expect(result.basePriceUsdc).toBe(30);
    expect(result.estimatedDeliveryHours).toBe(1);
  });

  it("should accept zero price", () => {
    const result = ServiceDefinitionSchema.parse({
      type: "free_tier",
      base_price_usdc: 0,
      estimated_delivery_hours: 24,
    });

    expect(result.basePriceUsdc).toBe(0);
  });

  it("should reject negative price", () => {
    expect(() =>
      ServiceDefinitionSchema.parse({
        type: "test",
        base_price_usdc: -10,
        estimated_delivery_hours: 1,
      }),
    ).toThrow();
  });

  it("should reject zero delivery hours", () => {
    expect(() =>
      ServiceDefinitionSchema.parse({
        type: "test",
        base_price_usdc: 10,
        estimated_delivery_hours: 0,
      }),
    ).toThrow();
  });

  it("should reject empty type", () => {
    expect(() =>
      ServiceDefinitionSchema.parse({
        type: "",
        base_price_usdc: 10,
        estimated_delivery_hours: 1,
      }),
    ).toThrow();
  });
});

// ============================================================================
// ServiceCatalogSchema
// ============================================================================

describe("ServiceCatalogSchema", () => {
  const validCatalog = {
    protocol: "IVXP/1.0",
    provider: "ResearchBot",
    wallet_address: VALID_ADDRESS,
    services: [
      {
        type: "research",
        base_price_usdc: 50,
        estimated_delivery_hours: 8,
      },
      {
        type: "code_review",
        base_price_usdc: 30,
        estimated_delivery_hours: 1,
      },
    ],
  };

  it("should parse valid catalog with snake_case -> camelCase transform", () => {
    const result = ServiceCatalogSchema.parse(validCatalog);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.provider).toBe("ResearchBot");
    expect(result.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.services).toHaveLength(2);
    expect(result.services[0].type).toBe("research");
    expect(result.services[0].basePriceUsdc).toBe(50);
    expect(result.services[0].estimatedDeliveryHours).toBe(8);
    expect(result.services[1].type).toBe("code_review");
    expect(result.messageType).toBeUndefined();
    expect(result.timestamp).toBeUndefined();
  });

  it("should include optional extension fields", () => {
    const result = ServiceCatalogSchema.parse({
      ...validCatalog,
      message_type: "service_catalog",
      timestamp: VALID_TIMESTAMP,
    });

    expect(result.messageType).toBe("service_catalog");
    expect(result.timestamp).toBe(VALID_TIMESTAMP);
  });

  it("should accept empty services array", () => {
    const result = ServiceCatalogSchema.parse({
      protocol: "IVXP/1.0",
      provider: "EmptyBot",
      wallet_address: VALID_ADDRESS,
      services: [],
    });

    expect(result.services).toHaveLength(0);
  });

  it("should reject wrong protocol version", () => {
    expect(() => ServiceCatalogSchema.parse({ ...validCatalog, protocol: "WRONG" })).toThrow();
  });

  it("should reject invalid wallet_address", () => {
    expect(() =>
      ServiceCatalogSchema.parse({
        ...validCatalog,
        wallet_address: "invalid",
      }),
    ).toThrow();
  });

  it("should reject missing provider", () => {
    const { provider: _, ...withoutProvider } = validCatalog;
    expect(() => ServiceCatalogSchema.parse(withoutProvider)).toThrow();
  });

  it("should reject empty provider name", () => {
    expect(() => ServiceCatalogSchema.parse({ ...validCatalog, provider: "" })).toThrow();
  });

  it("should reject invalid service definitions in array", () => {
    expect(() =>
      ServiceCatalogSchema.parse({
        ...validCatalog,
        services: [{ type: "" }],
      }),
    ).toThrow();
  });

  it("should reject null input", () => {
    expect(() => ServiceCatalogSchema.parse(null)).toThrow();
  });
});

// ============================================================================
// ClientAgentSchema
// ============================================================================

describe("ClientAgentSchema", () => {
  it("should parse valid client agent with camelCase transform", () => {
    const result = ClientAgentSchema.parse({
      name: "ResearchAssistant",
      wallet_address: VALID_ADDRESS,
    });

    expect(result.name).toBe("ResearchAssistant");
    expect(result.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.contactEndpoint).toBeUndefined();
  });

  it("should include optional contact_endpoint", () => {
    const result = ClientAgentSchema.parse({
      name: "Agent",
      wallet_address: VALID_ADDRESS,
      contact_endpoint: "https://agent.example.com/receive",
    });

    expect(result.contactEndpoint).toBe("https://agent.example.com/receive");
  });

  it("should reject invalid contact_endpoint URL", () => {
    expect(() =>
      ClientAgentSchema.parse({
        name: "Agent",
        wallet_address: VALID_ADDRESS,
        contact_endpoint: "not-a-url",
      }),
    ).toThrow();
  });

  it("should reject missing name", () => {
    expect(() => ClientAgentSchema.parse({ wallet_address: VALID_ADDRESS })).toThrow();
  });
});

// ============================================================================
// ServiceRequestDetailsSchema
// ============================================================================

describe("ServiceRequestDetailsSchema", () => {
  it("should parse valid request details with camelCase transform", () => {
    const result = ServiceRequestDetailsSchema.parse({
      type: "code_review",
      description: "Review this Python code",
      budget_usdc: 50,
    });

    expect(result.type).toBe("code_review");
    expect(result.description).toBe("Review this Python code");
    expect(result.budgetUsdc).toBe(50);
    expect(result.deliveryFormat).toBeUndefined();
    expect(result.deadline).toBeUndefined();
  });

  it("should include optional fields", () => {
    const result = ServiceRequestDetailsSchema.parse({
      type: "translation",
      description: "Translate to Chinese",
      budget_usdc: 10,
      delivery_format: "markdown",
      deadline: "2026-02-06T00:00:00Z",
    });

    expect(result.deliveryFormat).toBe("markdown");
    expect(result.deadline).toBe("2026-02-06T00:00:00Z");
  });

  it("should reject zero budget", () => {
    expect(() =>
      ServiceRequestDetailsSchema.parse({
        type: "test",
        description: "test",
        budget_usdc: 0,
      }),
    ).toThrow();
  });

  it("should reject invalid delivery_format", () => {
    expect(() =>
      ServiceRequestDetailsSchema.parse({
        type: "test",
        description: "test",
        budget_usdc: 10,
        delivery_format: "html",
      }),
    ).toThrow();
  });
});

// ============================================================================
// ServiceRequestSchema
// ============================================================================

describe("ServiceRequestSchema", () => {
  const validServiceRequest = {
    protocol: "IVXP/1.0",
    message_type: "service_request",
    timestamp: VALID_TIMESTAMP,
    client_agent: {
      name: "ResearchAssistant",
      wallet_address: VALID_ADDRESS,
    },
    service_request: {
      type: "code_review",
      description: "Review this Python code for security issues",
      budget_usdc: 50,
    },
  };

  it("should parse valid service request with snake_case -> camelCase transform", () => {
    const result = ServiceRequestSchema.parse(validServiceRequest);

    expect(result.protocol).toBe("IVXP/1.0");
    expect(result.messageType).toBe("service_request");
    expect(result.timestamp).toBe(VALID_TIMESTAMP);
    expect(result.clientAgent.name).toBe("ResearchAssistant");
    expect(result.clientAgent.walletAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.serviceRequest.type).toBe("code_review");
    expect(result.serviceRequest.budgetUsdc).toBe(50);
  });

  it("should include all optional fields", () => {
    const result = ServiceRequestSchema.parse({
      ...validServiceRequest,
      client_agent: {
        ...validServiceRequest.client_agent,
        contact_endpoint: "https://agent.example.com/receive",
      },
      service_request: {
        ...validServiceRequest.service_request,
        delivery_format: "json",
        deadline: "2026-02-06T00:00:00Z",
      },
    });

    expect(result.clientAgent.contactEndpoint).toBe("https://agent.example.com/receive");
    expect(result.serviceRequest.deliveryFormat).toBe("json");
    expect(result.serviceRequest.deadline).toBe("2026-02-06T00:00:00Z");
  });

  it("should reject wrong protocol version", () => {
    expect(() =>
      ServiceRequestSchema.parse({
        ...validServiceRequest,
        protocol: "WRONG",
      }),
    ).toThrow();
  });

  it("should reject wrong message_type", () => {
    expect(() =>
      ServiceRequestSchema.parse({
        ...validServiceRequest,
        message_type: "service_quote",
      }),
    ).toThrow();
  });

  it("should reject missing client_agent", () => {
    const { client_agent: _, ...withoutAgent } = validServiceRequest;
    expect(() => ServiceRequestSchema.parse(withoutAgent)).toThrow();
  });

  it("should reject missing service_request", () => {
    const { service_request: _, ...withoutReq } = validServiceRequest;
    expect(() => ServiceRequestSchema.parse(withoutReq)).toThrow();
  });

  it("should reject empty object", () => {
    expect(() => ServiceRequestSchema.parse({})).toThrow();
  });
});
