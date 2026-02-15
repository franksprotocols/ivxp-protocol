/**
 * Tests for service fixtures.
 */

import { describe, expect, it } from "vitest";
import {
  createMockClientAgent,
  createMockServiceCatalog,
  createMockServiceDefinition,
  createMockServiceRequest,
  createMockServiceRequestDetails,
  DEFAULT_SERVICE_DEFINITIONS,
} from "./services.js";
import { TEST_ACCOUNTS } from "./wallets.js";

describe("service fixtures", () => {
  describe("createMockServiceDefinition", () => {
    it("should create a valid service definition", () => {
      const def = createMockServiceDefinition();
      expect(def.type).toBe("code_review");
      expect(def.base_price_usdc).toBe(10);
      expect(def.estimated_delivery_hours).toBe(1);
    });

    it("should allow overrides", () => {
      const def = createMockServiceDefinition({
        type: "translation",
        base_price_usdc: 30,
      });
      expect(def.type).toBe("translation");
      expect(def.base_price_usdc).toBe(30);
    });
  });

  describe("DEFAULT_SERVICE_DEFINITIONS", () => {
    it("should contain multiple service types", () => {
      expect(DEFAULT_SERVICE_DEFINITIONS.length).toBeGreaterThan(1);
      const types = DEFAULT_SERVICE_DEFINITIONS.map((s) => s.type);
      expect(types).toContain("code_review");
      expect(types).toContain("translation");
      expect(types).toContain("research_report");
    });
  });

  describe("createMockServiceCatalog", () => {
    it("should create a valid service catalog", () => {
      const catalog = createMockServiceCatalog();
      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.provider).toBe("TestProvider");
      expect(catalog.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
      expect(catalog.services.length).toBeGreaterThan(0);
      expect(catalog.message_type).toBe("service_catalog");
    });

    it("should allow overrides", () => {
      const catalog = createMockServiceCatalog({
        provider: "CustomProvider",
        services: [createMockServiceDefinition({ type: "custom" })],
      });
      expect(catalog.provider).toBe("CustomProvider");
      expect(catalog.services.length).toBe(1);
      expect(catalog.services[0].type).toBe("custom");
    });
  });

  describe("createMockClientAgent", () => {
    it("should create a valid client agent", () => {
      const agent = createMockClientAgent();
      expect(agent.name).toBe("TestClient");
      expect(agent.wallet_address).toBe(TEST_ACCOUNTS.client.address);
    });

    it("should allow overrides", () => {
      const agent = createMockClientAgent({
        name: "CustomClient",
        contact_endpoint: "https://example.com/deliver",
      });
      expect(agent.name).toBe("CustomClient");
      expect(agent.contact_endpoint).toBe("https://example.com/deliver");
    });
  });

  describe("createMockServiceRequestDetails", () => {
    it("should create valid request details", () => {
      const details = createMockServiceRequestDetails();
      expect(details.type).toBe("code_review");
      expect(details.description).toBeDefined();
      expect(details.budget_usdc).toBe(15);
      expect(details.delivery_format).toBe("markdown");
    });
  });

  describe("createMockServiceRequest", () => {
    it("should create a valid service request", () => {
      const request = createMockServiceRequest();
      expect(request.protocol).toBe("IVXP/1.0");
      expect(request.message_type).toBe("service_request");
      expect(request.timestamp).toBeDefined();
      expect(request.client_agent.name).toBe("TestClient");
      expect(request.service_request.type).toBe("code_review");
    });

    it("should allow nested overrides", () => {
      const request = createMockServiceRequest({
        client_agent: { name: "OverriddenClient", wallet_address: TEST_ACCOUNTS.thirdParty.address },
        service_request: { type: "translation", description: "Translate to French", budget_usdc: 30 },
      });
      expect(request.client_agent.name).toBe("OverriddenClient");
      expect(request.service_request.type).toBe("translation");
    });
  });
});
