/**
 * MockProvider -- In-memory IVXP/1.0 provider for end-to-end tests.
 *
 * Simulates protocol message handling for catalog/quote/payment/status/download
 * without requiring a real HTTP server process.
 */

import type { HexAddress } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MockOrderStatus = "quoted" | "paid" | "processing" | "delivered" | "delivery_failed";

export interface MockProviderStartConfig {
  readonly providerAddress: HexAddress;
  readonly providerName?: string;
  readonly baseUrl?: string;
  readonly serviceType?: string;
  readonly priceUsdc?: string;
}

export interface MockServiceCatalogMessage {
  readonly protocol: "IVXP/1.0";
  readonly message_type: "service_catalog";
  readonly provider_address: HexAddress;
  readonly provider_name: string;
  readonly services: readonly {
    readonly service_type: string;
    readonly price_usdc: string;
  }[];
}

export interface MockServiceQuoteMessage {
  readonly protocol: "IVXP/1.0";
  readonly message_type: "service_quote";
  readonly order_id: string;
  readonly service_type: string;
  readonly price_usdc: string;
  readonly payment_address: HexAddress;
  readonly expires_at: string;
}

export interface MockDeliveryAcceptedMessage {
  readonly protocol: "IVXP/1.0";
  readonly message_type: "delivery_accepted";
  readonly order_id: string;
  readonly status: "processing";
}

export interface MockOrderStatusMessage {
  readonly order_id: string;
  readonly status: MockOrderStatus;
}

export interface MockDeliverableMessage {
  readonly order_id: string;
  readonly content: ArrayBuffer;
  readonly content_type: string;
  readonly content_hash: string;
  readonly file_name: string;
}

interface MockOrderRecord {
  readonly orderId: string;
  readonly serviceType: string;
  readonly priceUsdc: string;
  readonly paymentAddress: HexAddress;
  readonly expiresAt: string;
  readonly status: MockOrderStatus;
  readonly deliverable?: MockDeliverableMessage;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function nextOrderId(): string {
  return `ord_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toArrayBuffer(input: string): ArrayBuffer {
  return new TextEncoder().encode(input).buffer as ArrayBuffer;
}

function fakeContentHash(content: ArrayBuffer): string {
  // Deterministic lightweight hash for test infrastructure only.
  const bytes = new Uint8Array(content);
  let acc = 0;
  for (const value of bytes) {
    acc = (acc + value) % 0xffff_ffff;
  }
  return acc.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class MockProvider {
  public readonly protocolVersion = "IVXP/1.0" as const;
  public readonly baseUrl: string;
  public readonly providerAddress: HexAddress;
  public readonly providerName: string;
  public isRunning = true;

  private readonly serviceType: string;
  private readonly priceUsdc: string;
  private orders = new Map<string, MockOrderRecord>();

  private constructor(config: MockProviderStartConfig) {
    this.baseUrl = config.baseUrl ?? "http://localhost:3001";
    this.providerAddress = config.providerAddress;
    this.providerName = config.providerName ?? "Mock Provider";
    this.serviceType = config.serviceType ?? "text_echo";
    this.priceUsdc = config.priceUsdc ?? "1.00";
  }

  static async start(config: MockProviderStartConfig): Promise<MockProvider> {
    return new MockProvider(config);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  async getCatalog(): Promise<MockServiceCatalogMessage> {
    return {
      protocol: this.protocolVersion,
      message_type: "service_catalog",
      provider_address: this.providerAddress,
      provider_name: this.providerName,
      services: [
        {
          service_type: this.serviceType,
          price_usdc: this.priceUsdc,
        },
      ],
    };
  }

  async requestQuote(params: {
    readonly service_type: string;
    readonly input: Record<string, unknown>;
  }): Promise<MockServiceQuoteMessage> {
    const orderId = nextOrderId();
    const expiresAt = new Date(Date.now() + FIFTEEN_MINUTES_MS).toISOString();

    const record: MockOrderRecord = {
      orderId,
      serviceType: params.service_type,
      priceUsdc: this.priceUsdc,
      paymentAddress: this.providerAddress,
      expiresAt,
      status: "quoted",
    };

    this.orders = new Map(this.orders);
    this.orders.set(orderId, record);

    return {
      protocol: this.protocolVersion,
      message_type: "service_quote",
      order_id: orderId,
      service_type: params.service_type,
      price_usdc: this.priceUsdc,
      payment_address: this.providerAddress,
      expires_at: expiresAt,
    };
  }

  async submitPayment(params: {
    readonly order_id: string;
    readonly tx_hash: `0x${string}`;
  }): Promise<{ readonly status: "accepted" }> {
    const order = this.orders.get(params.order_id);
    if (!order) {
      throw new Error(`Order not found: ${params.order_id}`);
    }

    const updated: MockOrderRecord = { ...order, status: "paid" };
    this.orders = new Map(this.orders);
    this.orders.set(params.order_id, updated);

    return { status: "accepted" };
  }

  async requestDelivery(params: {
    readonly order_id: string;
    readonly signature: `0x${string}`;
  }): Promise<MockDeliveryAcceptedMessage> {
    const order = this.orders.get(params.order_id);
    if (!order) {
      throw new Error(`Order not found: ${params.order_id}`);
    }

    const content = toArrayBuffer(`deliverable:${params.order_id}`);
    const deliverable: MockDeliverableMessage = {
      order_id: params.order_id,
      content,
      content_type: "text/plain",
      content_hash: fakeContentHash(content),
      file_name: "result.txt",
    };

    const updated: MockOrderRecord = {
      ...order,
      status: "delivered",
      deliverable,
    };

    this.orders = new Map(this.orders);
    this.orders.set(params.order_id, updated);

    return {
      protocol: this.protocolVersion,
      message_type: "delivery_accepted",
      order_id: params.order_id,
      status: "processing",
    };
  }

  async getStatus(orderId: string): Promise<MockOrderStatusMessage> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    return { order_id: orderId, status: order.status };
  }

  async downloadDeliverable(orderId: string): Promise<MockDeliverableMessage> {
    const order = this.orders.get(orderId);
    if (!order || !order.deliverable) {
      throw new Error(`Deliverable not found for order: ${orderId}`);
    }
    return order.deliverable;
  }
}
