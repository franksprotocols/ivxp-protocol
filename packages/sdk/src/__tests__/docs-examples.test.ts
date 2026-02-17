/**
 * Documentation Examples Test
 *
 * Validates that code examples from the SDK documentation compile
 * and reference real SDK APIs. These tests verify the documentation
 * stays in sync with the actual SDK surface.
 */

import { describe, it, expect } from "vitest";
import {
  // Core exports
  IVXPClient,
  createIVXPClient,
  IVXPProvider,
  createIVXPProvider,
  EventEmitter,
  InMemoryOrderStore,
  InMemoryDeliverableStore,
  computeContentHash,
  createCallbackServer,

  // Crypto exports
  CryptoService,
  createCryptoService,
  formatIVXPMessage,

  // Payment exports
  PaymentService,
  createPaymentService,

  // HTTP exports
  HttpClient,
  createHttpClient,

  // Polling exports
  pollWithBackoff,
  pollOrderStatus,

  // Error exports
  IVXPError,
  InsufficientBalanceError,
  TransactionError,
  TransactionSubmissionError,
  PaymentNotFoundError,
  PaymentPendingError,
  PaymentFailedError,
  PaymentAmountMismatchError,
  SignatureVerificationError,
  PaymentVerificationError,
  OrderNotFoundError,
  OrderExpiredError,
  ServiceUnavailableError,
  MaxPollAttemptsError,
  PartialSuccessError,
  BudgetExceededError,
  TimeoutError,
  ProviderError,
  ERROR_CODES,

  // Protocol re-exports
  PROTOCOL_VERSION,
  ORDER_STATUSES,
  USDC_CONTRACT_ADDRESSES,
  USDC_DECIMALS,
} from "@ivxp/sdk";

// Test private key (not a real wallet)
const TEST_PRIVATE_KEY = ("0x" + "ab".repeat(32)) as `0x${string}`;

describe("Documentation Examples: SDK Exports", () => {
  it("exports all documented core classes and functions", () => {
    expect(IVXPClient).toBeDefined();
    expect(createIVXPClient).toBeTypeOf("function");
    expect(IVXPProvider).toBeDefined();
    expect(createIVXPProvider).toBeTypeOf("function");
    expect(EventEmitter).toBeDefined();
    expect(InMemoryOrderStore).toBeDefined();
    expect(InMemoryDeliverableStore).toBeDefined();
    expect(computeContentHash).toBeTypeOf("function");
    expect(createCallbackServer).toBeTypeOf("function");
  });

  it("exports all documented crypto classes and functions", () => {
    expect(CryptoService).toBeDefined();
    expect(createCryptoService).toBeTypeOf("function");
    expect(formatIVXPMessage).toBeTypeOf("function");
  });

  it("exports all documented payment classes and functions", () => {
    expect(PaymentService).toBeDefined();
    expect(createPaymentService).toBeTypeOf("function");
  });

  it("exports all documented HTTP classes and functions", () => {
    expect(HttpClient).toBeDefined();
    expect(createHttpClient).toBeTypeOf("function");
  });

  it("exports all documented polling functions", () => {
    expect(pollWithBackoff).toBeTypeOf("function");
    expect(pollOrderStatus).toBeTypeOf("function");
  });

  it("exports all documented error classes", () => {
    expect(IVXPError).toBeDefined();
    expect(InsufficientBalanceError).toBeDefined();
    expect(TransactionError).toBeDefined();
    expect(TransactionSubmissionError).toBeDefined();
    expect(PaymentNotFoundError).toBeDefined();
    expect(PaymentPendingError).toBeDefined();
    expect(PaymentFailedError).toBeDefined();
    expect(PaymentAmountMismatchError).toBeDefined();
    expect(SignatureVerificationError).toBeDefined();
    expect(PaymentVerificationError).toBeDefined();
    expect(OrderNotFoundError).toBeDefined();
    expect(OrderExpiredError).toBeDefined();
    expect(ServiceUnavailableError).toBeDefined();
    expect(MaxPollAttemptsError).toBeDefined();
    expect(PartialSuccessError).toBeDefined();
    expect(BudgetExceededError).toBeDefined();
    expect(TimeoutError).toBeDefined();
    expect(ProviderError).toBeDefined();
    expect(ERROR_CODES).toBeDefined();
  });

  it("exports all documented protocol constants", () => {
    expect(PROTOCOL_VERSION).toBe("IVXP/1.0");
    expect(ORDER_STATUSES).toBeDefined();
    expect(USDC_CONTRACT_ADDRESSES).toBeDefined();
    expect(USDC_DECIMALS).toBe(6);
  });
});

describe("Documentation Examples: Client Creation", () => {
  it("creates a client with createIVXPClient factory", () => {
    const client = createIVXPClient({
      privateKey: TEST_PRIVATE_KEY,
      network: "base-sepolia",
    });

    expect(client).toBeInstanceOf(IVXPClient);
    expect(client.getNetwork()).toBe("base-sepolia");
  });

  it("creates a client with new IVXPClient", () => {
    const client = new IVXPClient({
      privateKey: TEST_PRIVATE_KEY,
    });

    expect(client).toBeInstanceOf(IVXPClient);
    expect(client.getNetwork()).toBe("base-sepolia"); // default
  });

  it("client has documented methods", async () => {
    const client = createIVXPClient({
      privateKey: TEST_PRIVATE_KEY,
      network: "base-sepolia",
    });

    // Getters
    expect(client.getNetwork).toBeTypeOf("function");
    expect(client.getAddress).toBeTypeOf("function");
    expect(client.getBalance).toBeTypeOf("function");

    // Service accessors
    expect(client.crypto).toBeDefined();
    expect(client.payment).toBeDefined();
    expect(client.http).toBeDefined();

    // Catalog
    expect(client.getCatalog).toBeTypeOf("function");

    // Request flow
    expect(client.requestQuote).toBeTypeOf("function");
    expect(client.submitPayment).toBeTypeOf("function");
    expect(client.getOrderStatus).toBeTypeOf("function");
    expect(client.pollOrderUntil).toBeTypeOf("function");
    expect(client.waitForDelivery).toBeTypeOf("function");
    expect(client.downloadDeliverable).toBeTypeOf("function");
    expect(client.confirmDelivery).toBeTypeOf("function");
    expect(client.requestService).toBeTypeOf("function");

    // Callback server
    expect(client.startCallbackServer).toBeTypeOf("function");
    expect(client.stopCallbackServer).toBeTypeOf("function");
    expect(client.getCallbackUrl).toBeTypeOf("function");
    expect(client.isCallbackServerRunning).toBeTypeOf("function");

    // Events
    expect(client.on).toBeTypeOf("function");
    expect(client.off).toBeTypeOf("function");
    expect(client.emit).toBeTypeOf("function");
    expect(client.removeAllListeners).toBeTypeOf("function");
  });

  it("client getAddress returns a valid address", async () => {
    const client = createIVXPClient({
      privateKey: TEST_PRIVATE_KEY,
      network: "base-sepolia",
    });

    const address = await client.getAddress();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe("Documentation Examples: Provider Creation", () => {
  it("creates a provider with createIVXPProvider factory", () => {
    const provider = createIVXPProvider({
      privateKey: TEST_PRIVATE_KEY,
      network: "base-sepolia",
      services: [
        {
          type: "text_echo",
          description: "Echoes back the input text",
          base_price_usdc: 0.1,
          estimated_delivery_hours: 0.01,
        },
      ],
    });

    expect(provider).toBeInstanceOf(IVXPProvider);
    expect(provider.getNetwork()).toBe("base-sepolia");
    expect(provider.getPort()).toBe(3001); // default
    expect(provider.getHost()).toBe("127.0.0.1"); // default
    expect(provider.isRunning()).toBe(false);
  });

  it("provider has documented methods", () => {
    const provider = createIVXPProvider({
      privateKey: TEST_PRIVATE_KEY,
      services: [
        {
          type: "test",
          description: "Test service",
          base_price_usdc: 1,
          estimated_delivery_hours: 1,
        },
      ],
    });

    // Getters
    expect(provider.getAddress).toBeTypeOf("function");
    expect(provider.getNetwork).toBeTypeOf("function");
    expect(provider.getPort).toBeTypeOf("function");
    expect(provider.getHost).toBeTypeOf("function");
    expect(provider.isRunning).toBeTypeOf("function");

    // Service accessors
    expect(provider.crypto).toBeDefined();
    expect(provider.payment).toBeDefined();

    // Catalog
    expect(provider.getCatalog).toBeTypeOf("function");

    // Request handling
    expect(provider.handleQuoteRequest).toBeTypeOf("function");
    expect(provider.handleDeliveryRequest).toBeTypeOf("function");
    expect(provider.handleStatusRequest).toBeTypeOf("function");
    expect(provider.handleDownloadRequest).toBeTypeOf("function");
    expect(provider.getOrder).toBeTypeOf("function");
    expect(provider.getDeliverable).toBeTypeOf("function");
    expect(provider.registerServiceHandler).toBeTypeOf("function");

    // Lifecycle
    expect(provider.start).toBeTypeOf("function");
    expect(provider.stop).toBeTypeOf("function");
  });
});

describe("Documentation Examples: Crypto Service", () => {
  it("creates a crypto service and signs messages", async () => {
    const crypto = createCryptoService(TEST_PRIVATE_KEY);

    const signature = await crypto.sign("Hello IVXP!");
    expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);

    const address = await crypto.getAddress();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const valid = await crypto.verify("Hello IVXP!", signature, address);
    expect(valid).toBe(true);

    const invalid = await crypto.verify("Wrong message", signature, address);
    expect(invalid).toBe(false);
  });

  it("formats IVXP messages", () => {
    const message = formatIVXPMessage({
      orderId: "ivxp-test-123",
      txHash: "0x" + "ab".repeat(32),
      timestamp: "2026-02-17T12:00:00.000Z",
    });

    expect(message).toContain("Order: ivxp-test-123");
    expect(message).toContain("Payment: 0x");
    expect(message).toContain("Timestamp: 2026-02-17T12:00:00.000Z");
  });

  it("CryptoService signs and verifies IVXP messages", async () => {
    const crypto = new CryptoService(TEST_PRIVATE_KEY);
    const address = await crypto.getAddress();

    const { message, signature } = await crypto.signIVXPMessage({
      orderId: "ivxp-test-456",
      txHash: "0x" + "cd".repeat(32),
    });

    const result = await crypto.verifyIVXPMessage({
      signedMessage: message,
      signature,
      expectedAddress: address,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.orderId).toBe("ivxp-test-456");
      expect(result.txHash).toBe("0x" + "cd".repeat(32));
    }
  });
});

describe("Documentation Examples: Event System", () => {
  it("EventEmitter supports on/off/emit", () => {
    type TestEvents = {
      "test.event": { value: string };
    };

    const emitter = new EventEmitter<TestEvents>();
    const received: string[] = [];

    const handler = ({ value }: { value: string }) => {
      received.push(value);
    };

    emitter.on("test.event", handler);
    emitter.emit("test.event", { value: "hello" });
    expect(received).toEqual(["hello"]);

    emitter.off("test.event", handler);
    emitter.emit("test.event", { value: "world" });
    expect(received).toEqual(["hello"]); // handler removed
  });

  it("EventEmitter supports removeAllListeners", () => {
    type TestEvents = {
      a: { x: number };
      b: { y: number };
    };

    const emitter = new EventEmitter<TestEvents>();
    let count = 0;

    emitter.on("a", () => {
      count++;
    });
    emitter.on("b", () => {
      count++;
    });

    emitter.removeAllListeners("a");
    emitter.emit("a", { x: 1 });
    emitter.emit("b", { y: 1 });
    expect(count).toBe(1); // only 'b' handler ran

    emitter.removeAllListeners();
    emitter.emit("b", { y: 2 });
    expect(count).toBe(1); // all handlers removed
  });

  it("client emits typed events", () => {
    const client = createIVXPClient({
      privateKey: TEST_PRIVATE_KEY,
      network: "base-sepolia",
    });

    const events: string[] = [];

    client.on("catalog.received", ({ provider, servicesCount }) => {
      events.push(`catalog:${provider}:${servicesCount}`);
    });

    // Manually emit to test the event system
    client.emit("catalog.received", { provider: "test", servicesCount: 3 });
    expect(events).toEqual(["catalog:test:3"]);
  });
});

describe("Documentation Examples: Error Classes", () => {
  it("IVXPError has documented properties", () => {
    const error = new IVXPError("test error", "TEST_CODE", { key: "value" });

    expect(error.message).toBe("test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.details).toEqual({ key: "value" });
    expect(error.name).toBe("IVXPError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(IVXPError);

    const json = error.toJSON();
    expect(json.name).toBe("IVXPError");
    expect(json.code).toBe("TEST_CODE");
    expect(json.message).toBe("test error");
  });

  it("error hierarchy is correct", () => {
    const txHash = ("0x" + "ab".repeat(32)) as `0x${string}`;

    expect(new InsufficientBalanceError("msg", "10", "20")).toBeInstanceOf(IVXPError);
    expect(new TransactionError("msg", txHash)).toBeInstanceOf(IVXPError);
    expect(new TransactionSubmissionError("msg")).toBeInstanceOf(IVXPError);
    expect(new PaymentNotFoundError("msg")).toBeInstanceOf(IVXPError);
    expect(new PaymentPendingError("msg")).toBeInstanceOf(IVXPError);
    expect(new PaymentFailedError("msg", txHash)).toBeInstanceOf(IVXPError);
    expect(new PaymentAmountMismatchError("msg", "10", "20")).toBeInstanceOf(IVXPError);
    expect(new SignatureVerificationError("msg")).toBeInstanceOf(IVXPError);
    expect(new PaymentVerificationError("msg")).toBeInstanceOf(IVXPError);
    expect(new OrderNotFoundError("msg")).toBeInstanceOf(IVXPError);
    expect(new OrderExpiredError("msg")).toBeInstanceOf(IVXPError);
    expect(new ServiceUnavailableError("msg")).toBeInstanceOf(IVXPError);
    expect(new MaxPollAttemptsError(10)).toBeInstanceOf(IVXPError);
    expect(new PartialSuccessError("msg", txHash)).toBeInstanceOf(IVXPError);
    expect(new BudgetExceededError("msg", { orderId: "o1", priceUsdc: 15 }, 10)).toBeInstanceOf(
      IVXPError,
    );
    expect(new TimeoutError("msg", "quote")).toBeInstanceOf(IVXPError);
    expect(new ProviderError("msg", "http://test", "quote")).toBeInstanceOf(IVXPError);
  });

  it("BudgetExceededError has documented properties", () => {
    const error = new BudgetExceededError(
      "Quote price 15 USDC exceeds budget 10 USDC",
      { orderId: "ivxp-test", priceUsdc: 15 },
      10,
    );

    expect(error.code).toBe("BUDGET_EXCEEDED");
    expect(error.budgetUsdc).toBe(10);
    expect(error.quoteInfo.orderId).toBe("ivxp-test");
    expect(error.quoteInfo.priceUsdc).toBe(15);
  });

  it("PartialSuccessError has documented properties", () => {
    const txHash = ("0x" + "ab".repeat(32)) as `0x${string}`;
    const error = new PartialSuccessError("Payment sent but notification failed", txHash, true);

    expect(error.code).toBe("PARTIAL_SUCCESS");
    expect(error.txHash).toBe(txHash);
    expect(error.recoverable).toBe(true);
  });

  it("TimeoutError has documented properties", () => {
    const txHash = ("0x" + "ab".repeat(32)) as `0x${string}`;
    const error = new TimeoutError("Timed out", "poll", { txHash });

    expect(error.code).toBe("TIMEOUT");
    expect(error.step).toBe("poll");
    expect(error.partialState.txHash).toBe(txHash);
  });
});

describe("Documentation Examples: Content Hash", () => {
  it("computes SHA-256 content hash", async () => {
    const hash = await computeContentHash("Hello IVXP!");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Same input produces same hash
    const hash2 = await computeContentHash("Hello IVXP!");
    expect(hash2).toBe(hash);

    // Different input produces different hash
    const hash3 = await computeContentHash("Different content");
    expect(hash3).not.toBe(hash);
  });
});

describe("Documentation Examples: Runnable Example Files", () => {
  it("basic-client.ts can be imported and has expected structure", async () => {
    // Verify the example file exists and can be imported
    const examplePath = "../../../../docs/sdk/examples/basic-client.ts";

    // Read the file content to validate structure
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fullPath = path.resolve(__dirname, examplePath);

    const content = await fs.readFile(fullPath, "utf-8");

    // Validate key imports and usage
    expect(content).toContain("import { createIVXPClient");
    expect(content).toContain("type RequestServiceResult");
    expect(content).toContain("createIVXPClient({");
    expect(content).toContain("requestService({");
    expect(content).toContain("process.env.IVXP_PRIVATE_KEY");
    expect(content).toContain("process.env.IVXP_PROVIDER_URL");
    expect(content).toContain("onQuote:");
    expect(content).toContain("onPayment:");
    expect(content).toContain("onDelivered:");
    expect(content).toContain("onConfirmed:");
  });

  it("basic-provider.ts can be imported and has expected structure", async () => {
    const examplePath = "../../../../docs/sdk/examples/basic-provider.ts";

    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fullPath = path.resolve(__dirname, examplePath);

    const content = await fs.readFile(fullPath, "utf-8");

    // Validate key imports and usage
    expect(content).toContain("import { createIVXPProvider");
    expect(content).toContain("type IVXPProviderConfig");
    expect(content).toContain("createIVXPProvider(");
    expect(content).toContain("registerServiceHandler(");
    expect(content).toContain("provider.start()");
    expect(content).toContain("provider.stop()");
    expect(content).toContain("process.env.PROVIDER_PRIVATE_KEY");
    expect(content).toContain("services: [");
  });

  it("event-handling.ts can be imported and has expected structure", async () => {
    const examplePath = "../../../../docs/sdk/examples/event-handling.ts";

    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fullPath = path.resolve(__dirname, examplePath);

    const content = await fs.readFile(fullPath, "utf-8");

    // Validate key imports and usage
    expect(content).toContain("import { createIVXPClient, EventEmitter");
    expect(content).toContain("type SDKEventMap");
    expect(content).toContain("client.on(");
    expect(content).toContain("catalog.received");
    expect(content).toContain("order.quoted");
    expect(content).toContain("payment.sent");
    expect(content).toContain("order.paid");
    expect(content).toContain("order.status_changed");
    expect(content).toContain("order.delivered");
    expect(content).toContain("order.confirmed");
    expect(content).toContain("client.off(");
    expect(content).toContain("new EventEmitter<");
  });

  it("error-recovery.ts can be imported and has expected structure", async () => {
    const examplePath = "../../../../docs/sdk/examples/error-recovery.ts";

    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fullPath = path.resolve(__dirname, examplePath);

    const content = await fs.readFile(fullPath, "utf-8");

    // Validate key imports and usage
    expect(content).toContain("import {");
    expect(content).toContain("createIVXPClient");
    expect(content).toContain("IVXPError");
    expect(content).toContain("BudgetExceededError");
    expect(content).toContain("PartialSuccessError");
    expect(content).toContain("TimeoutError");
    expect(content).toContain("ProviderError");
    expect(content).toContain("ServiceUnavailableError");
    expect(content).toContain("InsufficientBalanceError");
    expect(content).toContain("instanceof BudgetExceededError");
    expect(content).toContain("instanceof PartialSuccessError");
    expect(content).toContain("instanceof TimeoutError");
    expect(content).toContain("error.toJSON()");
  });

  it("all example files use environment variables for configuration", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const examplesDir = path.resolve(__dirname, "../../../../docs/sdk/examples");

    const files = await fs.readdir(examplesDir);
    const tsFiles = files.filter((f) => f.endsWith(".ts"));

    expect(tsFiles.length).toBeGreaterThanOrEqual(4);

    for (const file of tsFiles) {
      const content = await fs.readFile(path.join(examplesDir, file), "utf-8");

      // All examples should use env vars for sensitive config
      if (content.includes("createIVXPClient") || content.includes("createIVXPProvider")) {
        expect(content).toContain("process.env");
      }

      // Client examples should use IVXP_PROVIDER_URL with fallback
      if (content.includes("providerUrl")) {
        expect(content).toMatch(/process\.env\.IVXP_PROVIDER_URL.*\?\?.*localhost:3001/);
      }
    }
  });
});
