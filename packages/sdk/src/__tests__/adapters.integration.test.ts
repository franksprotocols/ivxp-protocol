/**
 * Integration tests for IVXPClientAdapter and IVXPProviderAdapter interfaces.
 *
 * Verifies compile-time contract enforcement and runtime callability.
 * These tests act as a gate before Adapter packages depend on the SDK.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import type { IVXPClientAdapter, IVXPProviderAdapter } from "../index.js";
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

// ---------------------------------------------------------------------------
// IVXPClientAdapter — compile-time contract
// ---------------------------------------------------------------------------

describe("IVXPClientAdapter — compile-time contract", () => {
  it("accepts a fully correct implementation", () => {
    const adapter: IVXPClientAdapter = {
      getCatalog: async (_url: string): Promise<ServiceCatalogOutput> =>
        ({}) as ServiceCatalogOutput,
      requestQuote: async (
        _url: string,
        _params: ServiceRequestParams,
      ): Promise<ServiceQuoteOutput> => ({}) as ServiceQuoteOutput,
      requestDelivery: async (
        _url: string,
        _id: string,
        _proof: PaymentProofOutput,
        _sig: HexSignature,
        _msg: string,
      ): Promise<DeliveryAcceptedOutput> => ({}) as DeliveryAcceptedOutput,
      getStatus: async (_url: string, _id: string): Promise<OrderStatusResponseOutput> =>
        ({}) as OrderStatusResponseOutput,
      download: async (
        _url: string,
        _id: string,
        _opts?: DownloadOptions,
      ): Promise<DeliveryResponseOutput> => ({}) as DeliveryResponseOutput,
    };
    expectTypeOf(adapter).toMatchTypeOf<IVXPClientAdapter>();
  });

  it("rejects an implementation missing a method", () => {
    // @ts-expect-error — missing 'download' method
    const bad: IVXPClientAdapter = {
      getCatalog: async () => ({}) as ServiceCatalogOutput,
      requestQuote: async () => ({}) as ServiceQuoteOutput,
      requestDelivery: async () => ({}) as DeliveryAcceptedOutput,
      getStatus: async () => ({}) as OrderStatusResponseOutput,
    };
    void bad;
  });

  it("rejects an implementation with wrong method signature", () => {
    // @ts-expect-error — requestQuote second param must be ServiceRequestParams
    const bad: IVXPClientAdapter = {
      getCatalog: async (_url: string) => ({}) as ServiceCatalogOutput,
      requestQuote: async (_url: string, _params: string) => ({}) as ServiceQuoteOutput,
      requestDelivery: async (
        _url: string,
        _id: string,
        _proof: PaymentProofOutput,
        _sig: HexSignature,
        _msg: string,
      ) => ({}) as DeliveryAcceptedOutput,
      getStatus: async (_url: string, _id: string) => ({}) as OrderStatusResponseOutput,
      download: async (_url: string, _id: string, _opts?: DownloadOptions) =>
        ({}) as DeliveryResponseOutput,
    };
    void bad;
  });

  it("has exactly 5 methods", () => {
    const methods: Array<keyof IVXPClientAdapter> = [
      "getCatalog",
      "requestQuote",
      "requestDelivery",
      "getStatus",
      "download",
    ];
    expect(methods).toHaveLength(5);
  });

  it("mock adapter methods are callable and return expected shapes", async () => {
    const adapter: IVXPClientAdapter = {
      getCatalog: async (_url: string) =>
        ({
          protocol: "IVXP/1.0",
          provider: "Test",
          walletAddress: "0xabc" as `0x${string}`,
          services: [],
        }) as ServiceCatalogOutput,
      requestQuote: async () => ({ orderId: "ivxp-001" }) as ServiceQuoteOutput,
      requestDelivery: async () =>
        ({
          status: "accepted",
          orderId: "ivxp-001",
          message: "processing",
        }) as DeliveryAcceptedOutput,
      getStatus: async () =>
        ({
          orderId: "ivxp-001",
          status: "delivered",
          createdAt: "2026-02-16T13:00:00Z",
          serviceType: "code_review",
          priceUsdc: 10,
        }) as OrderStatusResponseOutput,
      download: async () =>
        ({
          protocol: "IVXP/1.0",
          messageType: "service_delivery",
          timestamp: "2026-02-16T13:00:00Z",
          orderId: "ivxp-001",
          status: "completed",
          providerAgent: {
            name: "Test",
            walletAddress: "0xabc" as `0x${string}`,
          },
          deliverable: {
            type: "code_review_result",
            format: "json",
            content: { score: 95 },
          },
        }) as DeliveryResponseOutput,
    };

    const catalog = await adapter.getCatalog("http://provider.test");
    expect(catalog.protocol).toBe("IVXP/1.0");

    const quote = await adapter.requestQuote("http://provider.test", {
      serviceType: "code_review",
      requirements: "review my code",
    });
    expect(quote.orderId).toBe("ivxp-001");

    const delivery = await adapter.requestDelivery(
      "http://provider.test",
      "ivxp-001",
      {} as PaymentProofOutput,
      "0x1234" as HexSignature,
      "signed",
    );
    expect(delivery.status).toBe("accepted");
    expect(delivery.orderId).toBe("ivxp-001");

    const status = await adapter.getStatus("http://provider.test", "ivxp-001");
    expect(status.status).toBe("delivered");
    expect(status.orderId).toBe("ivxp-001");

    const downloaded = await adapter.download("http://provider.test", "ivxp-001");
    expect(downloaded.orderId).toBe("ivxp-001");
    expect(downloaded.status).toBe("completed");
    expect(downloaded.deliverable.type).toBe("code_review_result");
  });
});

// ---------------------------------------------------------------------------
// IVXPProviderAdapter — compile-time contract
// ---------------------------------------------------------------------------

describe("IVXPProviderAdapter — compile-time contract", () => {
  it("accepts a fully correct implementation", () => {
    const adapter: IVXPProviderAdapter = {
      handleCatalog: async (): Promise<ServiceCatalogOutput> => ({}) as ServiceCatalogOutput,
      handleRequest: async (_body: ServiceRequestOutput): Promise<ServiceQuoteOutput> =>
        ({}) as ServiceQuoteOutput,
      handleDeliver: async (_body: DeliveryRequestOutput): Promise<DeliveryAcceptedOutput> =>
        ({}) as DeliveryAcceptedOutput,
      handleStatus: async (_id: string): Promise<OrderStatusResponseOutput> =>
        ({}) as OrderStatusResponseOutput,
      handleDownload: async (_id: string): Promise<DeliveryResponseOutput> =>
        ({}) as DeliveryResponseOutput,
    };
    expectTypeOf(adapter).toMatchTypeOf<IVXPProviderAdapter>();
  });

  it("rejects an implementation missing a method", () => {
    // @ts-expect-error — missing 'handleDownload' method
    const bad: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async () => ({}) as ServiceQuoteOutput,
      handleDeliver: async () => ({}) as DeliveryAcceptedOutput,
      handleStatus: async () => ({}) as OrderStatusResponseOutput,
    };
    void bad;
  });

  it("rejects an implementation with wrong method signature", () => {
    // @ts-expect-error — handleStatus param must be a string orderId
    const bad: IVXPProviderAdapter = {
      handleCatalog: async () => ({}) as ServiceCatalogOutput,
      handleRequest: async (_body: ServiceRequestOutput) => ({}) as ServiceQuoteOutput,
      handleDeliver: async (_body: DeliveryRequestOutput) => ({}) as DeliveryAcceptedOutput,
      handleStatus: async (_id: number) => ({}) as OrderStatusResponseOutput,
      handleDownload: async (_id: string) => ({}) as DeliveryResponseOutput,
    };
    void bad;
  });

  it("has exactly 5 methods", () => {
    const methods: Array<keyof IVXPProviderAdapter> = [
      "handleCatalog",
      "handleRequest",
      "handleDeliver",
      "handleStatus",
      "handleDownload",
    ];
    expect(methods).toHaveLength(5);
  });

  it("mock adapter methods are callable and return expected shapes", async () => {
    const adapter: IVXPProviderAdapter = {
      handleCatalog: async () =>
        ({
          protocol: "IVXP/1.0",
          provider: "Test",
          walletAddress: "0xabc" as `0x${string}`,
          services: [],
        }) as ServiceCatalogOutput,
      handleRequest: async () => ({ orderId: "ivxp-001" }) as ServiceQuoteOutput,
      handleDeliver: async () =>
        ({
          status: "accepted",
          orderId: "ivxp-001",
          message: "processing",
        }) as DeliveryAcceptedOutput,
      handleStatus: async () =>
        ({
          orderId: "ivxp-001",
          status: "delivered",
          createdAt: "2026-02-16T13:00:00Z",
          serviceType: "code_review",
          priceUsdc: 10,
        }) as OrderStatusResponseOutput,
      handleDownload: async () =>
        ({
          protocol: "IVXP/1.0",
          messageType: "service_delivery",
          timestamp: "2026-02-16T13:00:00Z",
          orderId: "ivxp-001",
          status: "completed",
          providerAgent: {
            name: "Test",
            walletAddress: "0xabc" as `0x${string}`,
          },
          deliverable: {
            type: "code_review_result",
            format: "json",
            content: { score: 95 },
          },
        }) as DeliveryResponseOutput,
    };

    const catalog = await adapter.handleCatalog();
    expect(catalog.protocol).toBe("IVXP/1.0");

    const quote = await adapter.handleRequest({} as ServiceRequestOutput);
    expect(quote.orderId).toBe("ivxp-001");

    const delivery = await adapter.handleDeliver({} as DeliveryRequestOutput);
    expect(delivery.status).toBe("accepted");
    expect(delivery.orderId).toBe("ivxp-001");

    const status = await adapter.handleStatus("ivxp-001");
    expect(status.status).toBe("delivered");
    expect(status.orderId).toBe("ivxp-001");

    const downloaded = await adapter.handleDownload("ivxp-001");
    expect(downloaded.orderId).toBe("ivxp-001");
    expect(downloaded.status).toBe("completed");
    expect(downloaded.deliverable.type).toBe("code_review_result");
  });
});
