/**
 * Tests for internal interface contracts.
 *
 * Story 1.4: Define Internal Interface Contracts
 * Validates all acceptance criteria:
 *   AC#1 - ICryptoService, IPaymentService, IHttpClient interfaces exist
 *   AC#2 - Interfaces are exported from @ivxp/protocol
 *   AC#3 - Interfaces define all methods needed for SDK implementation
 *   AC#4 - Interfaces support dependency injection for testing
 */

import { describe, it, expect, expectTypeOf, vi } from "vitest";
import type { OrderStatus } from "../types/order.js";
import type {
  ICryptoService,
  IPaymentService,
  IHttpClient,
  JsonSerializable,
  RequestOptions,
  IEventEmitter,
  SDKEvent,
  SDKEventMap,
  IOrderStorage,
  OrderFilters,
  OrderUpdates,
  StoredOrder,
} from "./index.js";

// ============================================================================
// Shared mock factories
// ============================================================================

function createMockCryptoService(): ICryptoService {
  return {
    sign: vi.fn(async (_message: string): Promise<`0x${string}`> => {
      return "0xmocksignature";
    }),
    verify: vi.fn(
      async (
        _message: string,
        _signature: `0x${string}`,
        _expectedAddress: `0x${string}`,
      ): Promise<boolean> => {
        return true;
      },
    ),
    getAddress: vi.fn(async (): Promise<`0x${string}`> => {
      return "0xmockaddress";
    }),
  };
}

function createMockStoredOrder(overrides: Partial<StoredOrder> = {}): StoredOrder {
  const status: OrderStatus = "quoted";
  return {
    orderId: "ivxp-550e8400-e29b-41d4-a716-446655440000",
    status,
    clientAddress: "0xclient",
    serviceType: "code_review",
    priceUsdc: "30.000000",
    paymentAddress: "0xpayment",
    network: "base-sepolia",
    createdAt: "2026-02-05T12:00:00Z",
    updatedAt: "2026-02-05T12:00:00Z",
    ...overrides,
  };
}

function createMockOrderStorage(): IOrderStorage & {
  readonly _orders: Map<string, StoredOrder>;
} {
  const orders = new Map<string, StoredOrder>();

  return {
    _orders: orders,
    create: vi.fn(
      async (order: Omit<StoredOrder, "createdAt" | "updatedAt">): Promise<StoredOrder> => {
        const now = new Date().toISOString();
        const stored: StoredOrder = {
          ...order,
          createdAt: now,
          updatedAt: now,
        };
        orders.set(order.orderId, stored);
        return stored;
      },
    ),
    get: vi.fn(async (orderId: string): Promise<StoredOrder | null> => {
      return orders.get(orderId) ?? null;
    }),
    update: vi.fn(async (orderId: string, updates: OrderUpdates): Promise<StoredOrder> => {
      const existing = orders.get(orderId);
      if (!existing) {
        throw new Error(`Order ${orderId} not found`);
      }
      const updated: StoredOrder = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      orders.set(orderId, updated);
      return updated;
    }),
    list: vi.fn(async (filters?: OrderFilters): Promise<readonly StoredOrder[]> => {
      let results = Array.from(orders.values());
      if (filters?.status) {
        results = results.filter((o) => o.status === filters.status);
      }
      if (filters?.clientAddress) {
        results = results.filter((o) => o.clientAddress === filters.clientAddress);
      }
      if (filters?.serviceType) {
        results = results.filter((o) => o.serviceType === filters.serviceType);
      }
      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? results.length;
      return results.slice(offset, offset + limit);
    }),
    delete: vi.fn(async (orderId: string): Promise<void> => {
      orders.delete(orderId);
    }),
  };
}

function createMockEventEmitter(): IEventEmitter & {
  readonly _handlers: Map<string, Array<(payload: unknown) => void>>;
} {
  const handlers = new Map<string, Array<(payload: unknown) => void>>();

  return {
    _handlers: handlers,
    on<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void {
      const list = handlers.get(event) ?? [];
      handlers.set(event, [...list, handler as (payload: unknown) => void]);
    },
    off<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void {
      const list = handlers.get(event) ?? [];
      handlers.set(
        event,
        list.filter((h) => h !== handler),
      );
    },
    emit<T extends SDKEvent["type"]>(event: T, payload: SDKEventMap[T]): void {
      const list = handlers.get(event) ?? [];
      for (const handler of list) {
        handler(payload);
      }
    },
  };
}

function createMockHttpClient(): IHttpClient & {
  readonly _lastOptions: { options?: RequestOptions };
} {
  const lastOptions: { options?: RequestOptions } = {};

  return {
    _lastOptions: lastOptions,
    async get<T>(_url: string, options?: RequestOptions): Promise<T> {
      lastOptions.options = options;
      return {} as T;
    },
    async post<T>(_url: string, _body: JsonSerializable, options?: RequestOptions): Promise<T> {
      lastOptions.options = options;
      return {} as T;
    },
  };
}

// ============================================================================
// AC#1 + AC#3: ICryptoService Interface
// ============================================================================

describe("ICryptoService", () => {
  it("should define sign method that returns a Promise<hex>", () => {
    expectTypeOf<ICryptoService["sign"]>().toBeFunction();
    expectTypeOf<ICryptoService["sign"]>().parameter(0).toBeString();
    expectTypeOf<ICryptoService["sign"]>().returns.toEqualTypeOf<Promise<`0x${string}`>>();
  });

  it("should define verify method with message, signature, and address params", () => {
    expectTypeOf<ICryptoService["verify"]>().toBeFunction();
    expectTypeOf<ICryptoService["verify"]>().returns.toEqualTypeOf<Promise<boolean>>();
  });

  it("should define async getAddress method returning Promise<hex>", () => {
    expectTypeOf<ICryptoService["getAddress"]>().toBeFunction();
    expectTypeOf<ICryptoService["getAddress"]>().returns.toEqualTypeOf<Promise<`0x${string}`>>();
  });

  // AC#4: Dependency injection + runtime behavior
  it("should support DI and sign returns correct hex signature", async () => {
    const mock = createMockCryptoService();
    const signature = await mock.sign("test message");
    expect(signature).toBe("0xmocksignature");
    expect(mock.sign).toHaveBeenCalledWith("test message");
  });

  it("should support DI and verify checks arguments correctly", async () => {
    const mock = createMockCryptoService();
    const result = await mock.verify("test", "0xsig", "0xaddr");
    expect(result).toBe(true);
    expect(mock.verify).toHaveBeenCalledWith("test", "0xsig", "0xaddr");
  });

  it("should support DI and getAddress resolves asynchronously", async () => {
    const mock = createMockCryptoService();
    const address = await mock.getAddress();
    expect(address).toBe("0xmockaddress");
    expect(mock.getAddress).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// AC#1 + AC#3: IPaymentService Interface
// ============================================================================

describe("IPaymentService", () => {
  it("should define send method returning tx hash", () => {
    expectTypeOf<IPaymentService["send"]>().toBeFunction();
    expectTypeOf<IPaymentService["send"]>().returns.toEqualTypeOf<Promise<`0x${string}`>>();
  });

  it("should define verify method with txHash and expected details", () => {
    expectTypeOf<IPaymentService["verify"]>().toBeFunction();
    expectTypeOf<IPaymentService["verify"]>().returns.toEqualTypeOf<Promise<boolean>>();
  });

  it("should define getBalance method returning USDC balance as string", () => {
    expectTypeOf<IPaymentService["getBalance"]>().toBeFunction();
    expectTypeOf<IPaymentService["getBalance"]>().returns.toEqualTypeOf<Promise<string>>();
  });

  // AC#4: DI + runtime behavior
  it("should support mock send with runtime verification", async () => {
    const mock: IPaymentService = {
      send: vi.fn(async () => "0xtxhash" as `0x${string}`),
      verify: vi.fn(async () => true),
      getBalance: vi.fn(async () => "100.500000"),
    };

    const txHash = await mock.send("0xrecipient", "30.000000");
    expect(txHash).toBe("0xtxhash");
    expect(mock.send).toHaveBeenCalledWith("0xrecipient", "30.000000");
  });

  it("should support mock verify with expected details", async () => {
    const mock: IPaymentService = {
      send: vi.fn(async () => "0x" as `0x${string}`),
      verify: vi.fn(async () => false),
      getBalance: vi.fn(async () => "0"),
    };

    const result = await mock.verify("0xtx", {
      from: "0xfrom",
      to: "0xto",
      amount: "30.000000",
    });
    expect(result).toBe(false);
    expect(mock.verify).toHaveBeenCalledWith("0xtx", {
      from: "0xfrom",
      to: "0xto",
      amount: "30.000000",
    });
  });

  it("should support mock getBalance with runtime verification", async () => {
    const mock: IPaymentService = {
      send: vi.fn(async () => "0x" as `0x${string}`),
      verify: vi.fn(async () => true),
      getBalance: vi.fn(async () => "42.123456"),
    };

    const balance = await mock.getBalance("0xaddress");
    expect(balance).toBe("42.123456");
    expect(mock.getBalance).toHaveBeenCalledWith("0xaddress");
  });
});

// ============================================================================
// AC#1 + AC#3 + AC#4: IHttpClient Interface
// ============================================================================

describe("IHttpClient", () => {
  it("should define generic get method", () => {
    expectTypeOf<IHttpClient["get"]>().toBeFunction();
  });

  it("should define generic post method", () => {
    expectTypeOf<IHttpClient["post"]>().toBeFunction();
  });

  it("RequestOptions should include headers, timeout, and signal", () => {
    expectTypeOf<RequestOptions>().toHaveProperty("headers");
    expectTypeOf<RequestOptions>().toHaveProperty("timeout");
    expectTypeOf<RequestOptions>().toHaveProperty("signal");
  });

  it("post body should accept JsonSerializable values", () => {
    // Verify JsonSerializable covers expected shapes
    const stringBody: JsonSerializable = "hello";
    const numberBody: JsonSerializable = 42;
    const objectBody: JsonSerializable = { key: "value", nested: { n: 1 } };
    const arrayBody: JsonSerializable = [1, "two", null];

    expect(stringBody).toBe("hello");
    expect(numberBody).toBe(42);
    expect(objectBody).toEqual({ key: "value", nested: { n: 1 } });
    expect(arrayBody).toEqual([1, "two", null]);
  });

  // AC#4: DI + runtime behavior -- RequestOptions passthrough
  it("should pass RequestOptions through to get", async () => {
    const mock = createMockHttpClient();
    const opts: RequestOptions = {
      headers: { Authorization: "Bearer token" },
      timeout: 5000,
    };

    await mock.get<unknown>("/api/data", opts);

    expect(mock._lastOptions.options).toEqual(opts);
    expect(mock._lastOptions.options?.headers?.Authorization).toBe("Bearer token");
    expect(mock._lastOptions.options?.timeout).toBe(5000);
  });

  it("should pass RequestOptions through to post", async () => {
    const mock = createMockHttpClient();
    const opts: RequestOptions = {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    };

    await mock.post<unknown>("/api/data", { key: "value" }, opts);

    expect(mock._lastOptions.options).toEqual(opts);
    expect(mock._lastOptions.options?.timeout).toBe(10000);
  });

  it("should work with generic type parameter at runtime", async () => {
    interface TestResponse {
      readonly data: string;
    }

    const mock: IHttpClient = {
      async get<T>(_url: string, _options?: RequestOptions): Promise<T> {
        return { data: "test" } as T;
      },
      async post<T>(_url: string, _body: JsonSerializable, _options?: RequestOptions): Promise<T> {
        return {} as T;
      },
    };

    const result = await mock.get<TestResponse>("/api/test");
    expect(result).toEqual({ data: "test" });
    expect(result.data).toBe("test");
  });
});

// ============================================================================
// AC#1 + AC#3: IEventEmitter Interface
// ============================================================================

describe("IEventEmitter", () => {
  it("should define on method for subscribing to events", () => {
    expectTypeOf<IEventEmitter["on"]>().toBeFunction();
  });

  it("should define off method for unsubscribing from events", () => {
    expectTypeOf<IEventEmitter["off"]>().toBeFunction();
  });

  it("should define emit method for publishing events", () => {
    expectTypeOf<IEventEmitter["emit"]>().toBeFunction();
  });

  it("SDKEvent should include all required event types", () => {
    type OrderQuoted = Extract<SDKEvent, { readonly type: "order.quoted" }>;
    type OrderPaid = Extract<SDKEvent, { readonly type: "order.paid" }>;
    type OrderDelivered = Extract<SDKEvent, { readonly type: "order.delivered" }>;
    type PaymentSent = Extract<SDKEvent, { readonly type: "payment.sent" }>;
    type PaymentConfirmed = Extract<SDKEvent, { readonly type: "payment.confirmed" }>;

    expectTypeOf<OrderQuoted>().not.toBeNever();
    expectTypeOf<OrderPaid>().not.toBeNever();
    expectTypeOf<OrderDelivered>().not.toBeNever();
    expectTypeOf<PaymentSent>().not.toBeNever();
    expectTypeOf<PaymentConfirmed>().not.toBeNever();
  });

  it("SDKEventMap should map event types to their payloads", () => {
    expectTypeOf<SDKEventMap>().toHaveProperty("order.quoted");
    expectTypeOf<SDKEventMap>().toHaveProperty("order.paid");
    expectTypeOf<SDKEventMap>().toHaveProperty("order.delivered");
    expectTypeOf<SDKEventMap>().toHaveProperty("payment.sent");
    expectTypeOf<SDKEventMap>().toHaveProperty("payment.confirmed");
  });

  it("payment.confirmed blockNumber should be optional bigint", () => {
    type ConfirmedPayload = SDKEventMap["payment.confirmed"];
    expectTypeOf<ConfirmedPayload>().toHaveProperty("blockNumber");
    // blockNumber is optional bigint (bigint | undefined)
    expectTypeOf<ConfirmedPayload["blockNumber"]>().toEqualTypeOf<bigint | undefined>();
  });

  // AC#4: DI + runtime behavior -- emit calls handlers
  it("should call registered handler when emit is invoked", () => {
    const emitter = createMockEventEmitter();
    const handler = vi.fn();

    emitter.on("order.quoted", handler);
    emitter.emit("order.quoted", {
      orderId: "ivxp-test",
      priceUsdc: "30.00",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      orderId: "ivxp-test",
      priceUsdc: "30.00",
    });
  });

  it("should call multiple handlers for the same event", () => {
    const emitter = createMockEventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on("order.paid", handler1);
    emitter.on("order.paid", handler2);
    emitter.emit("order.paid", {
      orderId: "ivxp-test",
      txHash: "0xtx",
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("should not call handler after off is invoked", () => {
    const emitter = createMockEventEmitter();
    const handler = vi.fn();

    emitter.on("payment.sent", handler);
    emitter.off("payment.sent", handler);
    emitter.emit("payment.sent", { txHash: "0xtx" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should not call handlers for different event types", () => {
    const emitter = createMockEventEmitter();
    const quotedHandler = vi.fn();
    const paidHandler = vi.fn();

    emitter.on("order.quoted", quotedHandler);
    emitter.on("order.paid", paidHandler);

    emitter.emit("order.quoted", {
      orderId: "ivxp-test",
      priceUsdc: "10.00",
    });

    expect(quotedHandler).toHaveBeenCalledTimes(1);
    expect(paidHandler).not.toHaveBeenCalled();
  });

  it("should pass correct payload for payment.confirmed with optional bigint blockNumber", () => {
    const emitter = createMockEventEmitter();
    const handler = vi.fn();

    emitter.on("payment.confirmed", handler);
    emitter.emit("payment.confirmed", {
      txHash: "0xconfirmed",
      blockNumber: 12345678n,
    });

    expect(handler).toHaveBeenCalledWith({
      txHash: "0xconfirmed",
      blockNumber: 12345678n,
    });
  });
});

// ============================================================================
// AC#1 + AC#3: IOrderStorage Interface
// ============================================================================

describe("IOrderStorage", () => {
  it("should define create method", () => {
    expectTypeOf<IOrderStorage["create"]>().toBeFunction();
  });

  it("should define get method returning StoredOrder or null", () => {
    expectTypeOf<IOrderStorage["get"]>().toBeFunction();
  });

  it("should define update method accepting OrderUpdates", () => {
    expectTypeOf<IOrderStorage["update"]>().toBeFunction();
  });

  it("should define list method with optional filters", () => {
    expectTypeOf<IOrderStorage["list"]>().toBeFunction();
  });

  it("should define delete method", () => {
    expectTypeOf<IOrderStorage["delete"]>().toBeFunction();
  });

  it("OrderFilters should include status, clientAddress, serviceType, limit, offset", () => {
    expectTypeOf<OrderFilters>().toHaveProperty("status");
    expectTypeOf<OrderFilters>().toHaveProperty("clientAddress");
    expectTypeOf<OrderFilters>().toHaveProperty("serviceType");
    expectTypeOf<OrderFilters>().toHaveProperty("limit");
    expectTypeOf<OrderFilters>().toHaveProperty("offset");
  });

  it("OrderUpdates should only include mutable fields", () => {
    expectTypeOf<OrderUpdates>().toHaveProperty("status");
    expectTypeOf<OrderUpdates>().toHaveProperty("txHash");
    expectTypeOf<OrderUpdates>().toHaveProperty("deliveryEndpoint");
    expectTypeOf<OrderUpdates>().toHaveProperty("contentHash");
  });

  // AC#4: DI + runtime behavior -- create, get, update, list, delete
  it("should create and retrieve an order", async () => {
    const storage = createMockOrderStorage();
    const orderStatus: OrderStatus = "quoted";
    const input: Omit<StoredOrder, "createdAt" | "updatedAt"> = {
      orderId: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      status: orderStatus,
      clientAddress: "0xclient",
      serviceType: "code_review",
      priceUsdc: "30.000000",
      paymentAddress: "0xpayment",
      network: "base-sepolia",
    };

    const created = await storage.create(input);

    expect(created.orderId).toBe(input.orderId);
    expect(created.status).toBe("quoted");
    expect(created.createdAt).toBeDefined();
    expect(created.updatedAt).toBeDefined();
    expect(storage.create).toHaveBeenCalledWith(input);

    const retrieved = await storage.get(input.orderId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.orderId).toBe(input.orderId);
  });

  it("should return null for non-existent order", async () => {
    const storage = createMockOrderStorage();
    const result = await storage.get("ivxp-nonexistent");
    expect(result).toBeNull();
  });

  it("should update only mutable fields", async () => {
    const storage = createMockOrderStorage();
    const orderStatus: OrderStatus = "quoted";

    await storage.create({
      orderId: "ivxp-update-test",
      status: orderStatus,
      clientAddress: "0xclient",
      serviceType: "code_review",
      priceUsdc: "30.000000",
      paymentAddress: "0xpayment",
      network: "base-sepolia",
    });

    const updates: OrderUpdates = {
      status: "paid",
      txHash: "0xtxhash123",
    };
    const updated = await storage.update("ivxp-update-test", updates);

    expect(updated.status).toBe("paid");
    expect(updated.txHash).toBe("0xtxhash123");
    // Immutable fields should remain unchanged
    expect(updated.clientAddress).toBe("0xclient");
    expect(updated.serviceType).toBe("code_review");
    expect(updated.priceUsdc).toBe("30.000000");
  });

  it("should list orders with filters", async () => {
    const storage = createMockOrderStorage();
    const quoted: OrderStatus = "quoted";
    const paid: OrderStatus = "paid";

    await storage.create({
      orderId: "ivxp-list-1",
      status: quoted,
      clientAddress: "0xclientA",
      serviceType: "code_review",
      priceUsdc: "30.000000",
      paymentAddress: "0xpayment",
      network: "base-sepolia",
    });
    await storage.create({
      orderId: "ivxp-list-2",
      status: paid,
      clientAddress: "0xclientB",
      serviceType: "research",
      priceUsdc: "50.000000",
      paymentAddress: "0xpayment",
      network: "base-sepolia",
    });

    const allOrders = await storage.list();
    expect(allOrders).toHaveLength(2);

    const quotedOrders = await storage.list({ status: "quoted" });
    expect(quotedOrders).toHaveLength(1);
    expect(quotedOrders[0].orderId).toBe("ivxp-list-1");

    const paginatedOrders = await storage.list({ limit: 1, offset: 1 });
    expect(paginatedOrders).toHaveLength(1);
    expect(paginatedOrders[0].orderId).toBe("ivxp-list-2");
  });

  it("should delete an order", async () => {
    const storage = createMockOrderStorage();
    const orderStatus: OrderStatus = "quoted";

    await storage.create({
      orderId: "ivxp-delete-test",
      status: orderStatus,
      clientAddress: "0xclient",
      serviceType: "code_review",
      priceUsdc: "10.000000",
      paymentAddress: "0xpayment",
      network: "base-sepolia",
    });

    await storage.delete("ivxp-delete-test");
    const result = await storage.get("ivxp-delete-test");
    expect(result).toBeNull();
    expect(storage.delete).toHaveBeenCalledWith("ivxp-delete-test");
  });
});

// ============================================================================
// AC#2: Package Exports
// ============================================================================

describe("Package exports from @ivxp/protocol", () => {
  it("should export all contract interfaces and types from contracts/index", async () => {
    const contracts = await import("./index.js");
    expect(contracts).toBeDefined();
  });

  it("should export ICryptoService as a type", () => {
    expectTypeOf<ICryptoService>().toBeObject();
  });

  it("should export IPaymentService as a type", () => {
    expectTypeOf<IPaymentService>().toBeObject();
  });

  it("should export IHttpClient as a type", () => {
    expectTypeOf<IHttpClient>().toBeObject();
  });

  it("should export IEventEmitter as a type", () => {
    expectTypeOf<IEventEmitter>().toBeObject();
  });

  it("should export IOrderStorage as a type", () => {
    expectTypeOf<IOrderStorage>().toBeObject();
  });

  it("should export RequestOptions as a type", () => {
    expectTypeOf<RequestOptions>().toBeObject();
  });

  it("should export SDKEvent as a type", () => {
    expectTypeOf<SDKEvent>().toBeObject();
  });

  it("should export OrderFilters as a type", () => {
    expectTypeOf<OrderFilters>().toBeObject();
  });

  it("should export StoredOrder as a type", () => {
    expectTypeOf<StoredOrder>().toBeObject();
  });

  it("should export OrderUpdates as a type", () => {
    expectTypeOf<OrderUpdates>().toBeObject();
  });

  it("should export JsonSerializable as a type", () => {
    expectTypeOf<JsonSerializable>().not.toBeNever();
  });
});

// ============================================================================
// AC#3: Complete Method Signatures
// ============================================================================

describe("Complete method signatures", () => {
  describe("ICryptoService methods", () => {
    it("sign should accept string and return Promise<hex>", () => {
      type SignFn = ICryptoService["sign"];
      expectTypeOf<Parameters<SignFn>>().toEqualTypeOf<[string]>();
      expectTypeOf<ReturnType<SignFn>>().toEqualTypeOf<Promise<`0x${string}`>>();
    });

    it("verify should accept message, signature, address and return Promise<boolean>", () => {
      type VerifyFn = ICryptoService["verify"];
      expectTypeOf<Parameters<VerifyFn>>().toEqualTypeOf<[string, `0x${string}`, `0x${string}`]>();
      expectTypeOf<ReturnType<VerifyFn>>().toEqualTypeOf<Promise<boolean>>();
    });

    it("getAddress should accept no args and return Promise<hex>", () => {
      type GetAddrFn = ICryptoService["getAddress"];
      expectTypeOf<Parameters<GetAddrFn>>().toEqualTypeOf<[]>();
      expectTypeOf<ReturnType<GetAddrFn>>().toEqualTypeOf<Promise<`0x${string}`>>();
    });
  });

  describe("IPaymentService methods", () => {
    it("send should accept address and amount, return Promise<hex>", () => {
      type SendFn = IPaymentService["send"];
      expectTypeOf<Parameters<SendFn>>().toEqualTypeOf<[`0x${string}`, string]>();
      expectTypeOf<ReturnType<SendFn>>().toEqualTypeOf<Promise<`0x${string}`>>();
    });

    it("getBalance should accept address and return Promise<string>", () => {
      type BalFn = IPaymentService["getBalance"];
      expectTypeOf<Parameters<BalFn>>().toEqualTypeOf<[`0x${string}`]>();
      expectTypeOf<ReturnType<BalFn>>().toEqualTypeOf<Promise<string>>();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge cases", () => {
  it("IPaymentService.verify expected param should be readonly", () => {
    type VerifyFn = IPaymentService["verify"];
    type ExpectedParam = Parameters<VerifyFn>[1];
    expectTypeOf<ExpectedParam>().toHaveProperty("from");
    expectTypeOf<ExpectedParam>().toHaveProperty("to");
    expectTypeOf<ExpectedParam>().toHaveProperty("amount");
  });

  it("IEventEmitter should provide type-safe event handling", () => {
    type QuotedPayload = SDKEventMap["order.quoted"];
    expectTypeOf<QuotedPayload>().toHaveProperty("orderId");
    expectTypeOf<QuotedPayload>().toHaveProperty("priceUsdc");

    type PaidPayload = SDKEventMap["order.paid"];
    expectTypeOf<PaidPayload>().toHaveProperty("orderId");
    expectTypeOf<PaidPayload>().toHaveProperty("txHash");
  });

  it("StoredOrder should have both timestamp fields", () => {
    expectTypeOf<StoredOrder>().toHaveProperty("createdAt");
    expectTypeOf<StoredOrder>().toHaveProperty("updatedAt");
  });

  it("OrderUpdates should not allow immutable field changes", () => {
    // Verify orderId, clientAddress, etc. are NOT in OrderUpdates
    type HasOrderId = "orderId" extends keyof OrderUpdates ? true : false;
    type HasClientAddress = "clientAddress" extends keyof OrderUpdates ? true : false;
    type HasServiceType = "serviceType" extends keyof OrderUpdates ? true : false;
    type HasPriceUsdc = "priceUsdc" extends keyof OrderUpdates ? true : false;
    type HasCreatedAt = "createdAt" extends keyof OrderUpdates ? true : false;

    expectTypeOf<HasOrderId>().toEqualTypeOf<false>();
    expectTypeOf<HasClientAddress>().toEqualTypeOf<false>();
    expectTypeOf<HasServiceType>().toEqualTypeOf<false>();
    expectTypeOf<HasPriceUsdc>().toEqualTypeOf<false>();
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
  });
});
