/**
 * Type-level tests for IVXPClientAdapter and IVXPProviderAdapter interfaces.
 *
 * These tests verify that the adapter interfaces are correctly defined and
 * enforce the expected method signatures at compile time.
 */

import { describe, it, expectTypeOf } from "vitest";
import type {
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  DeliveryAcceptedOutput,
  DeliveryResponseOutput,
  OrderStatusResponseOutput,
  ServiceRequestOutput,
  DeliveryRequestOutput,
  PaymentProofOutput,
  HexSignature,
} from "@ivxp/protocol";
import type { ServiceRequestParams, DownloadOptions } from "../core/types.js";

// Import from public SDK entrypoint to validate consumer-facing exports.
import type { IVXPClientAdapter, IVXPProviderAdapter } from "../index.js";

describe("IVXPClientAdapter interface", () => {
  it("accepts a correct implementation at compile time", () => {
    const mock: IVXPClientAdapter = {
      getCatalog: async (_url: string) => ({}) as ServiceCatalogOutput,
      requestQuote: async (_url: string, _params: ServiceRequestParams) =>
        ({}) as ServiceQuoteOutput,
      requestDelivery: async (
        _url: string,
        _orderId: string,
        _paymentProof: PaymentProofOutput,
        _signature: HexSignature,
        _signedMessage: string,
      ) => ({}) as DeliveryAcceptedOutput,
      getStatus: async (_url: string, _orderId: string) => ({}) as OrderStatusResponseOutput,
      download: async (_url: string, _orderId: string, _options?: DownloadOptions) =>
        ({}) as DeliveryResponseOutput,
    };
    expectTypeOf(mock).toMatchTypeOf<IVXPClientAdapter>();
  });

  it("rejects a missing method at compile time", () => {
    // @ts-expect-error — missing download method
    const bad: IVXPClientAdapter = {
      getCatalog: async () => ({}) as ServiceCatalogOutput,
      requestQuote: async () => ({}) as ServiceQuoteOutput,
      requestDelivery: async () => ({}) as DeliveryAcceptedOutput,
      getStatus: async () => ({}) as OrderStatusResponseOutput,
    };
    void bad;
  });

  it("rejects incorrect requestDelivery argument types at compile time", () => {
    const mock: IVXPClientAdapter = {
      getCatalog: async () => ({}) as ServiceCatalogOutput,
      requestQuote: async () => ({}) as ServiceQuoteOutput,
      requestDelivery: async () => ({}) as DeliveryAcceptedOutput,
      getStatus: async () => ({}) as OrderStatusResponseOutput,
      download: async () => ({}) as DeliveryResponseOutput,
    };

    // @ts-expect-error — paymentProof must be PaymentProofOutput
    void mock.requestDelivery(
      "https://provider.example.com",
      "ivxp-123",
      "0xabc",
      "0x1234" as HexSignature,
      "signed message",
    );
  });

  it("rejects incorrect requestDelivery return type assumptions at compile time", () => {
    const mock: IVXPClientAdapter = {
      getCatalog: async () => ({}) as ServiceCatalogOutput,
      requestQuote: async () => ({}) as ServiceQuoteOutput,
      requestDelivery: async () => ({}) as DeliveryAcceptedOutput,
      getStatus: async () => ({}) as OrderStatusResponseOutput,
      download: async () => ({}) as DeliveryResponseOutput,
    };

    // @ts-expect-error — requestDelivery resolves DeliveryAcceptedOutput
    const wrongReturn: Promise<DeliveryResponseOutput> = mock.requestDelivery(
      "https://provider.example.com",
      "ivxp-123",
      {} as PaymentProofOutput,
      "0x1234" as HexSignature,
      "signed message",
    );
    void wrongReturn;
  });

  it("has exactly 5 methods", () => {
    const mock: IVXPClientAdapter = {
      getCatalog: async () => ({}) as ServiceCatalogOutput,
      requestQuote: async () => ({}) as ServiceQuoteOutput,
      requestDelivery: async () => ({}) as DeliveryAcceptedOutput,
      getStatus: async () => ({}) as OrderStatusResponseOutput,
      download: async () => ({}) as DeliveryResponseOutput,
    };

    // Verify method count at runtime
    const methodCount = Object.keys(mock).length;
    if (methodCount !== 5) {
      throw new Error(`Expected 5 methods, got ${methodCount}`);
    }
  });
});

describe("IVXPProviderAdapter interface", () => {
  it("accepts a correct implementation at compile time", () => {
    const mock: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async (_body: ServiceRequestOutput) => ({}) as ServiceQuoteOutput,
      handleDeliver: async (_body: DeliveryRequestOutput) => ({}) as DeliveryAcceptedOutput,
      handleStatus: async (_orderId: string) => ({}) as OrderStatusResponseOutput,
      handleDownload: async (_orderId: string) => ({}) as DeliveryResponseOutput,
    };
    expectTypeOf(mock).toMatchTypeOf<IVXPProviderAdapter>();
  });

  it("rejects a missing method at compile time", () => {
    // @ts-expect-error — missing handleDownload method
    const bad: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async () => ({}) as ServiceQuoteOutput,
      handleDeliver: async () => ({}) as DeliveryAcceptedOutput,
      handleStatus: async () => ({}) as OrderStatusResponseOutput,
    };
    void bad;
  });

  it("rejects incorrect provider body argument types at compile time", () => {
    const mock: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async () => ({}) as ServiceQuoteOutput,
      handleDeliver: async () => ({}) as DeliveryAcceptedOutput,
      handleStatus: async () => ({}) as OrderStatusResponseOutput,
      handleDownload: async () => ({}) as DeliveryResponseOutput,
    };

    // @ts-expect-error — handleRequest expects ServiceRequestOutput
    void mock.handleRequest("invalid-request");
    // @ts-expect-error — handleDeliver expects DeliveryRequestOutput
    void mock.handleDeliver("invalid-delivery-request");
  });

  it("has exactly 5 methods", () => {
    const mock: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async () => ({}) as ServiceQuoteOutput,
      handleDeliver: async () => ({}) as DeliveryAcceptedOutput,
      handleStatus: async () => ({}) as OrderStatusResponseOutput,
      handleDownload: async () => ({}) as DeliveryResponseOutput,
    };

    // Verify method count at runtime
    const methodCount = Object.keys(mock).length;
    if (methodCount !== 5) {
      throw new Error(`Expected 5 methods, got ${methodCount}`);
    }
  });
});
