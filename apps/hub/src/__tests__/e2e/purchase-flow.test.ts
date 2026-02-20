/**
 * E2E Integration Test: Complete Purchase Flow
 *
 * Covers full purchase lifecycle and required error/edge scenarios.
 *
 * ACs covered: #1, #2, #3, #4, #5, #6, #7, #8, #10, #11
 */

import { createElement } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act, waitFor, screen } from "@testing-library/react";
import { MOCK_SERVICES } from "@/lib/mock-data/services";
import { QuoteDialog } from "@/components/features/quote-dialog";
import { ServiceActions } from "@/components/features/service/ServiceActions";
import type { ServiceDetail } from "@/lib/types/service";
import type { Address } from "viem";
import { useOrderStore } from "@/stores/order-store";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TEST_WALLET_ADDRESS,
  TEST_WALLET_PRIVATE_KEY,
  PROVIDER_ADDRESS,
  FAKE_TX_HASH,
  FAKE_SIGNATURE,
  E2E_TEST_TIMEOUT,
  textToArrayBuffer,
  type E2ETestEnvironment,
} from "./helpers/setup";
import {
  assertEventOrder,
  assertPaymentCompleted,
  assertPaymentError,
  assertPartialSuccess,
  assertSignatureCompleted,
  assertSignatureError,
  assertDownloadSuccess,
  assertDownloadHashMismatch,
  assertDownloadError,
} from "./helpers/assertions";

const mockRefs = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  return {
    writeContractAsync: vi.fn(),
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
    signMessageAsync: vi.fn(),
    push: vi.fn(),
    chainId: { current: 84532 },
    address: {
      current: "0x1111111111111111111111111111111111111111" as Address | undefined,
    },
    ivxpClient: {
      current: {
        on: vi.fn((event: string, handler: (payload: unknown) => void) => {
          if (!handlers.has(event)) handlers.set(event, new Set());
          handlers.get(event)!.add(handler);
        }),
        off: vi.fn((event: string, handler: (payload: unknown) => void) => {
          handlers.get(event)?.delete(handler);
        }),
        emit: (event: string, payload: unknown) => {
          handlers.get(event)?.forEach((handler) => handler(payload));
        },
        requestQuote: vi.fn(),
        requestDelivery: vi.fn(),
        getOrderStatus: vi.fn(),
        downloadDeliverable: vi.fn(),
      },
      resetHandlers: () => handlers.clear(),
    },
  };
});

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockRefs.address.current,
    isConnected: Boolean(mockRefs.address.current),
  }),
  useChainId: () => mockRefs.chainId.current,
  useWriteContract: () => ({ writeContractAsync: mockRefs.writeContractAsync }),
  usePublicClient: () => ({
    readContract: mockRefs.readContract,
    waitForTransactionReceipt: mockRefs.waitForTransactionReceipt,
  }),
  useSignMessage: () => ({ signMessageAsync: mockRefs.signMessageAsync }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRefs.push }),
}));

vi.mock("@/hooks/use-ivxp-client", () => ({
  useIVXPClient: () => mockRefs.ivxpClient.current,
}));

const { usePayment } = await import("@/hooks/use-payment");
const { useServiceRequest } = await import("@/hooks/use-service-request");
const { useIdentitySignature, SIGNATURE_ERROR_CODES } =
  await import("@/hooks/use-identity-signature");
const { computeContentHash, useDeliverable } = await import("@/hooks/use-deliverable");
const { useOrderStatus } = await import("@/hooks/use-order-status");

class UserRejectedRequestError extends Error {
  constructor(message = "User rejected the request.") {
    super(message);
    this.name = "UserRejectedRequestError";
  }
}

function resetAllMocks() {
  vi.clearAllMocks();
  mockRefs.chainId.current = 84532;
  mockRefs.address.current = TEST_WALLET_ADDRESS;
  mockRefs.ivxpClient.resetHandlers();

  mockRefs.readContract.mockImplementation((params: { functionName: string }) => {
    if (params.functionName === "balanceOf") return Promise.resolve(10_000_000n);
    if (params.functionName === "allowance") return Promise.resolve(10_000_000n);
    return Promise.resolve(0n);
  });

  mockRefs.writeContractAsync.mockResolvedValue(FAKE_TX_HASH);
  mockRefs.waitForTransactionReceipt.mockResolvedValue({
    blockNumber: 42n,
    status: "success",
  });

  mockRefs.signMessageAsync.mockResolvedValue(FAKE_SIGNATURE);
  mockRefs.ivxpClient.current.requestQuote.mockResolvedValue({
    order_id: "ord_test_e2e_001",
    price_usdc: "1.00",
    payment_address: PROVIDER_ADDRESS,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    service_type: "text_echo",
  });
  mockRefs.ivxpClient.current.requestDelivery.mockResolvedValue({
    order_id: "ord_test_e2e_001",
    status: "processing",
  });
  mockRefs.ivxpClient.current.getOrderStatus.mockResolvedValue({
    order_id: "ord_test_e2e_001",
    status: "delivered",
  });

  mockRefs.ivxpClient.current.downloadDeliverable.mockReset();
  useOrderStore.getState().clearOrders();
}

function createServiceDetail(): ServiceDetail {
  return {
    service_type: "text_echo",
    description: "Echo service",
    price_usdc: "1.00",
    provider_address: PROVIDER_ADDRESS,
    provider_id: "prov-test",
    provider_endpoint_url: "http://localhost:3001",
    provider_name: "Mock Provider",
    category: "AI",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to echo" },
      },
      required: ["text"],
    },
    output_schema: {
      type: "string",
      format: "text/plain",
    },
  };
}

describe("E2E: Complete Purchase Flow", () => {
  let env: E2ETestEnvironment | null = null;

  beforeEach(async () => {
    resetAllMocks();
    env = await setupTestEnvironment();
  });

  afterEach(async () => {
    if (env) {
      await teardownTestEnvironment(env);
      env = null;
    }
  });

  it(
    "sets up E2E infrastructure with test accounts, provider, and mock USDC",
    async () => {
      expect(env).not.toBeNull();
      expect(env!.accounts.client.address).toBe(TEST_WALLET_ADDRESS);
      expect(env!.accounts.provider.address).toBe(PROVIDER_ADDRESS);

      expect(env!.mockProvider.isRunning).toBe(true);
      expect(env!.mockProvider.protocolVersion).toBe("IVXP/1.0");

      await env!.mockUsdc.mint(TEST_WALLET_ADDRESS, 1_000_000n);
      const balance = await env!.mockUsdc.balanceOf(TEST_WALLET_ADDRESS);
      expect(balance).toBeGreaterThanOrEqual(1_000_000n);

      // Verify mock provider handles IVXP/1.0 messages
      const catalog = await env!.mockProvider.getCatalog();
      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.message_type).toBe("service_catalog");

      const quote = await env!.mockProvider.requestQuote({
        service_type: "text_echo",
        input: { text: "Hello" },
      });
      expect(quote.protocol).toBe("IVXP/1.0");
      expect(quote.message_type).toBe("service_quote");

      await env!.mockProvider.submitPayment({
        order_id: quote.order_id,
        tx_hash: FAKE_TX_HASH,
      });
      const accepted = await env!.mockProvider.requestDelivery({
        order_id: quote.order_id,
        signature: FAKE_SIGNATURE,
      });
      expect(accepted.status).toBe("processing");

      const status = await env!.mockProvider.getStatus(quote.order_id);
      expect(status.status).toBe("delivered");

      const deliverable = await env!.mockProvider.downloadDeliverable(quote.order_id);
      expect(deliverable.order_id).toBe(quote.order_id);
      expect(deliverable.content_hash).toBeDefined();

      // Verify on-chain USDC transfer and receipt verification
      const transferHash = await env!.mockUsdc.transferFromPrivateKey(
        TEST_WALLET_PRIVATE_KEY,
        PROVIDER_ADDRESS,
        1_000_000n,
      );
      const verified = await env!.mockUsdc.verifyTransfer(
        transferHash,
        PROVIDER_ADDRESS,
        1_000_000n,
      );
      expect(verified).toBe(true);
    },
    E2E_TEST_TIMEOUT,
  );

  it(
    "completes provider-endpoint-aware real flow: request->pay->sign->status->download",
    async () => {
      const providerBaseUrl = env!.mockProvider.baseUrl;

      mockRefs.ivxpClient.current.requestQuote.mockImplementation(
        async (
          _providerUrl: string,
          params: { service_type: string; input: Record<string, unknown> },
        ) => {
          const quote = await env!.mockProvider.requestQuote({
            service_type: params.service_type,
            input: params.input,
          });
          return {
            order_id: quote.order_id,
            price_usdc: quote.price_usdc,
            payment_address: quote.payment_address,
            expires_at: quote.expires_at,
            service_type: quote.service_type,
          };
        },
      );
      mockRefs.ivxpClient.current.requestDelivery.mockImplementation(
        async (
          providerUrl: string,
          payload: { order_id: string; signature: { sig: `0x${string}` } },
        ) => {
          expect(providerUrl).toBe(providerBaseUrl);
          const accepted = await env!.mockProvider.requestDelivery({
            order_id: payload.order_id,
            signature: payload.signature.sig,
          });
          return { order_id: accepted.order_id, status: accepted.status };
        },
      );
      mockRefs.ivxpClient.current.getOrderStatus.mockImplementation(
        async (providerUrl: string, orderId: string) => {
          expect(providerUrl).toBe(providerBaseUrl);
          return env!.mockProvider.getStatus(orderId);
        },
      );
      mockRefs.ivxpClient.current.downloadDeliverable.mockImplementation(
        async (providerUrl: string, orderId: string) => {
          expect(providerUrl).toBe(providerBaseUrl);
          const deliverable = await env!.mockProvider.downloadDeliverable(orderId);
          return {
            content: deliverable.content,
            contentType: deliverable.content_type,
            contentHash: await computeContentHash(deliverable.content),
            fileName: deliverable.file_name,
          };
        },
      );

      // Track protocol events for the entire flow session
      const { result: eventsHook } = renderHook(() => useProtocolEvents("flow-session"));

      // Browse
      expect(MOCK_SERVICES.length).toBeGreaterThan(0);
      const selectedService = MOCK_SERVICES[0];

      // Request -> Quote
      const { result: requestHook } = renderHook(() => useServiceRequest());
      let quote: Awaited<ReturnType<typeof requestHook.current.submitRequest>> = null;
      await act(async () => {
        quote = await requestHook.current.submitRequest(
          selectedService.service_type,
          providerBaseUrl,
          { text: "Hello" },
        );
      });
      expect(quote).not.toBeNull();
      expect(quote!.order_id).toBeDefined();

      // Payment
      const { result: paymentHook } = renderHook(() => usePayment(quote!.order_id));
      await act(async () => {
        await paymentHook.current.initiatePayment(PROVIDER_ADDRESS, quote!.price_usdc);
      });
      assertPaymentCompleted(paymentHook.current.step, paymentHook.current.txHash);
      await env!.mockProvider.submitPayment({
        order_id: quote!.order_id,
        tx_hash: paymentHook.current.txHash!,
      });

      useOrderStore.getState().addOrder({
        orderId: quote!.order_id,
        serviceType: quote!.service_type,
        priceUsdc: quote!.price_usdc,
        providerAddress: PROVIDER_ADDRESS,
        providerEndpointUrl: providerBaseUrl,
        status: "paid",
        createdAt: Date.now(),
      });

      // Signature / Delivery request
      const { result: signatureHook } = renderHook(() =>
        useIdentitySignature({ orderId: quote!.order_id, txHash: FAKE_TX_HASH }),
      );
      await act(async () => {
        await signatureHook.current.signAndDeliver();
      });
      assertSignatureCompleted(signatureHook.current.step, signatureHook.current.signature);

      const { result: orderStatusHook } = renderHook(() => useOrderStatus(quote!.order_id));
      expect(orderStatusHook.current.isPolling).toBe(true);

      await waitFor(
        () => {
          expect(mockRefs.ivxpClient.current.getOrderStatus).toHaveBeenCalledWith(
            providerBaseUrl,
            quote!.order_id,
          );
        },
        { timeout: 5_000 },
      );

      await waitFor(
        () => {
          expect(orderStatusHook.current.order?.status).toBe("delivered");
        },
        { timeout: 5_000 },
      );

      // Download
      const { result: deliverableHook } = renderHook(() => useDeliverable(quote!.order_id));
      await act(async () => {
        await deliverableHook.current.download();
      });

      assertDownloadSuccess(
        deliverableHook.current.hashStatus,
        deliverableHook.current.content,
        deliverableHook.current.error,
      );

      assertEventOrder(eventsHook.current.events, [
        "order.quoted",
        "payment.sent",
        "payment.confirmed",
        "order.paid",
        "order.delivered",
      ]);
    },
    E2E_TEST_TIMEOUT,
  );

  it("handles payment insufficient balance error", async () => {
    mockRefs.readContract.mockImplementation((params: { functionName: string }) => {
      if (params.functionName === "balanceOf") return Promise.resolve(100n);
      if (params.functionName === "allowance") return Promise.resolve(0n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => usePayment("ord_pay_err_1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDRESS, "1.00");
    });

    assertPaymentError(result.current.step, result.current.error, "INSUFFICIENT_BALANCE");
  });

  it("handles wallet transaction rejection and supports retry", async () => {
    mockRefs.writeContractAsync
      .mockRejectedValueOnce(new UserRejectedRequestError())
      .mockResolvedValue(FAKE_TX_HASH);

    const { result } = renderHook(() => usePayment("ord_pay_err_2"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDRESS, "1.00");
    });

    assertPaymentError(result.current.step, result.current.error, "USER_REJECTED");

    await act(async () => {
      await result.current.retry();
    });

    assertPaymentCompleted(result.current.step, result.current.txHash);
  });

  it("handles transaction reverted on chain", async () => {
    mockRefs.waitForTransactionReceipt.mockResolvedValue({
      blockNumber: 88n,
      status: "reverted",
    });

    const { result } = renderHook(() => usePayment("ord_pay_err_3"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDRESS, "1.00");
    });

    assertPaymentError(result.current.step, result.current.error, "TRANSACTION_REVERTED");
  });

  it("handles PartialSuccessError-like recovery path", async () => {
    mockRefs.waitForTransactionReceipt
      .mockRejectedValueOnce(new Error("verification timeout"))
      .mockResolvedValueOnce({ blockNumber: 99n, status: "success" });

    const { result } = renderHook(() => usePayment("ord_pay_err_4"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDRESS, "1.00");
    });

    assertPartialSuccess(result.current.step, result.current.txHash, result.current.error);

    await act(async () => {
      await result.current.retryVerification();
    });

    assertPaymentCompleted(result.current.step, result.current.txHash);
  });

  it("handles signature rejection, wrong-account failure, and retry", async () => {
    mockRefs.signMessageAsync.mockRejectedValueOnce(new UserRejectedRequestError());

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: "ord_sig_1", txHash: FAKE_TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });
    assertSignatureError(
      result.current.step,
      result.current.errorCode,
      SIGNATURE_ERROR_CODES.USER_REJECTED,
    );

    mockRefs.signMessageAsync.mockResolvedValueOnce(FAKE_SIGNATURE);
    mockRefs.ivxpClient.current.requestDelivery.mockRejectedValueOnce(
      new Error("Signer does not match wallet"),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });
    assertSignatureError(
      result.current.step,
      result.current.errorCode,
      SIGNATURE_ERROR_CODES.DELIVERY_FAILED,
    );

    mockRefs.ivxpClient.current.requestDelivery.mockResolvedValueOnce({
      order_id: "ord_sig_1",
      status: "processing",
    });

    await act(async () => {
      await result.current.retryDelivery();
    });

    assertSignatureCompleted(result.current.step, result.current.signature);
  });

  it("shows quote expiry UX and prompts requesting a new quote", async () => {
    const onRequestNewQuote = vi.fn();

    render(
      createElement(QuoteDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm: vi.fn(),
        onRequestNewQuote,
        quote: {
          orderId: "ord_quote_expired",
          serviceType: "text_echo",
          priceUsdc: "1.00",
          providerAddress: PROVIDER_ADDRESS,
          expiresAt: new Date(Date.now() - 1_000),
        },
      }),
    );

    expect(await waitFor(() => screen.getByText("Request New Quote"))).toBeDefined();
  });

  it("handles deliverable download failures and hash mismatch", async () => {
    const { result } = renderHook(() => useDeliverable("ord_dl_1"));

    mockRefs.ivxpClient.current.downloadDeliverable.mockRejectedValueOnce(
      new Error("Network error"),
    );
    await act(async () => {
      await result.current.download();
    });
    assertDownloadError(result.current.error, "Network error");

    const content = textToArrayBuffer("wrong-hash-content");
    mockRefs.ivxpClient.current.downloadDeliverable.mockResolvedValueOnce({
      content,
      contentType: "text/plain",
      contentHash: "deadbeef",
      fileName: "bad.txt",
    });

    await act(async () => {
      await result.current.download();
    });
    assertDownloadHashMismatch(
      result.current.hashStatus,
      result.current.content,
      result.current.error,
    );

    mockRefs.ivxpClient.current.downloadDeliverable.mockRejectedValueOnce(
      new Error("Order not found. It may have expired or been cancelled."),
    );

    await act(async () => {
      await result.current.download();
    });
    assertDownloadError(result.current.error, "Order not found");
  });

  it("handles wallet disconnection during quote confirmation and signature", async () => {
    const onConfirm = vi.fn();
    mockRefs.address.current = undefined;

    render(
      createElement(QuoteDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onConfirm,
        onRequestNewQuote: vi.fn(),
        quote: {
          orderId: "ord_quote_disconnect",
          serviceType: "text_echo",
          priceUsdc: "1.00",
          providerAddress: PROVIDER_ADDRESS,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    );
    expect(await waitFor(() => screen.getByTestId("reconnect-prompt"))).toBeDefined();
    expect(screen.getByText("Reconnect Wallet")).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();

    const { result: signatureHook } = renderHook(() =>
      useIdentitySignature({ orderId: "ord_sig_disconnect", txHash: FAKE_TX_HASH }),
    );
    await act(async () => {
      await signatureHook.current.signAndDeliver();
    });
    assertSignatureError(
      signatureHook.current.step,
      signatureHook.current.errorCode,
      SIGNATURE_ERROR_CODES.WALLET_DISCONNECTED,
    );
  });

  it("shows reconnection prompts and preserves flow state where possible", async () => {
    // Wallet disconnected prompt in service actions UI
    mockRefs.address.current = undefined;
    render(createElement(ServiceActions, { service: createServiceDetail() }));
    expect(await waitFor(() => screen.getByTestId("wallet-prompt"))).toBeDefined();

    // Start with connected wallet so payment args are captured.
    mockRefs.address.current = TEST_WALLET_ADDRESS;
    mockRefs.writeContractAsync.mockRejectedValueOnce(new UserRejectedRequestError());
    const { result: paymentHook, rerender } = renderHook(() => usePayment("ord_disconnect_1"));
    await act(async () => {
      await paymentHook.current.initiatePayment(PROVIDER_ADDRESS, "1.00");
    });
    assertPaymentError(paymentHook.current.step, paymentHook.current.error, "USER_REJECTED");

    // Disconnect wallet before retry -> should show reconnect prompt error.
    mockRefs.address.current = undefined;
    rerender();
    await act(async () => {
      await paymentHook.current.retry();
    });
    assertPaymentError(paymentHook.current.step, paymentHook.current.error, "WALLET_NOT_CONNECTED");

    // Reconnect and retry should work
    mockRefs.address.current = TEST_WALLET_ADDRESS;
    rerender();
    await act(async () => {
      await paymentHook.current.retry();
    });
    assertPaymentCompleted(paymentHook.current.step, paymentHook.current.txHash);
  });
});
