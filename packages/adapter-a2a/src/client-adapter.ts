/**
 * IVXPA2AClientAdapter -- Wraps IVXPClient for use within the A2A framework.
 *
 * Implements the IVXPClientAdapter interface from @ivxp/sdk, delegating
 * each method to the underlying IVXPClient while managing A2A Task state
 * transitions (submitted -> working -> completed | failed).
 *
 * Error conversion: IVXPError is never surfaced to A2A callers. All errors
 * are converted to A2ATaskErrorImpl with a formatted message and taskId attached.
 */

import { randomBytes } from "node:crypto";
import {
  IVXPClient,
  IVXPError,
  createHttpClient,
  PROTOCOL_VERSION,
  type IVXPClientAdapter,
  type ServiceRequestParams,
  type DownloadOptions,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
  type DeliveryResponseOutput,
} from "@ivxp/sdk";
import {
  DeliveryAcceptedSchema,
  type PaymentProofOutput,
  type HexSignature,
  type DeliveryAcceptedOutput,
  type JsonSerializable,
} from "@ivxp/protocol";
import type { Task, TaskState } from "@a2a-js/sdk";
import type { A2AAdapterConfig } from "./types.js";

// ---------------------------------------------------------------------------
// A2A Task Error
// ---------------------------------------------------------------------------

/**
 * Error type surfaced to A2A callers.
 * Extends Error with an optional taskId for correlation.
 */
export interface A2ATaskError extends Error {
  readonly taskId?: string;
}

/** Concrete implementation of A2ATaskError. */
class A2ATaskErrorImpl extends Error implements A2ATaskError {
  constructor(
    message: string,
    public readonly taskId?: string,
  ) {
    super(message);
    this.name = "A2ATaskError";
  }
}

// ---------------------------------------------------------------------------
// IVXPA2AClientAdapter
// ---------------------------------------------------------------------------

/** IVXP Client Adapter for the Google A2A framework. */
export class IVXPA2AClientAdapter implements IVXPClientAdapter {
  private readonly client: IVXPClient;

  constructor(config: A2AAdapterConfig) {
    this.client = new IVXPClient({
      privateKey: config.privateKey,
      network: config.network ?? "base-sepolia",
    });
  }

  // -- getCatalog -----------------------------------------------------------

  async getCatalog(providerUrl: string): Promise<ServiceCatalogOutput> {
    return this.client.getCatalog(providerUrl);
  }

  // -- requestQuote ---------------------------------------------------------

  async requestQuote(
    providerUrl: string,
    params: ServiceRequestParams,
  ): Promise<ServiceQuoteOutput> {
    return this.client.requestQuote(providerUrl, params);
  }

  // -- requestDelivery ------------------------------------------------------

  /**
   * Notify the provider of payment and request delivery.
   * Maps to POST /ivxp/deliver.
   *
   * Use buildNonce() and buildSignedMessage() to construct the signedMessage argument.
   */
  async requestDelivery(
    providerUrl: string,
    orderId: string,
    paymentProof: PaymentProofOutput,
    signature: HexSignature,
    signedMessage: string,
  ): Promise<DeliveryAcceptedOutput> {
    const httpClient = createHttpClient();
    const normalizedUrl = providerUrl.replace(/\/+$/, "");
    const deliverUrl = `${normalizedUrl}/ivxp/deliver`;

    const body: JsonSerializable = {
      protocol: PROTOCOL_VERSION,
      message_type: "delivery_request",
      timestamp: new Date().toISOString(),
      order_id: orderId,
      payment_proof: {
        tx_hash: paymentProof.txHash,
        from_address: paymentProof.fromAddress,
        network: paymentProof.network,
        ...(paymentProof.toAddress !== undefined && { to_address: paymentProof.toAddress }),
        ...(paymentProof.amountUsdc !== undefined && { amount_usdc: paymentProof.amountUsdc }),
        ...(paymentProof.blockNumber !== undefined && { block_number: paymentProof.blockNumber }),
      },
      signature,
      signed_message: signedMessage,
    };

    const rawResponse = await httpClient.post<unknown>(deliverUrl, body);
    return DeliveryAcceptedSchema.parse(rawResponse);
  }

  // -- getStatus ------------------------------------------------------------

  async getStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponseOutput> {
    return this.client.getOrderStatus(providerUrl, orderId);
  }

  // -- download -------------------------------------------------------------

  async download(
    providerUrl: string,
    orderId: string,
    options?: DownloadOptions,
  ): Promise<DeliveryResponseOutput> {
    return this.client.downloadDeliverable(providerUrl, orderId, options);
  }

  // -- A2A Task lifecycle helpers -------------------------------------------

  /**
   * Request a quote and transition the A2A Task to 'working'.
   *
   * On success: returns the quote and a Task with state 'working'.
   * On failure: throws A2ATaskError (IVXPError is converted; task state is NOT updated).
   */
  async requestQuoteWithTask(
    task: Task,
    providerUrl: string,
    params: ServiceRequestParams,
  ): Promise<{ readonly quote: ServiceQuoteOutput; readonly updatedTask: Task }> {
    try {
      const quote = await this.requestQuote(providerUrl, params);
      const updatedTask = setTaskState(task, "working");
      return { quote, updatedTask };
    } catch (err) {
      throw toA2AError(task, err);
    }
  }

  /**
   * Download a deliverable and transition the A2A Task to 'completed'.
   *
   * On success: returns the deliverable and a Task with state 'completed'.
   * On failure: throws A2ATaskError (IVXPError is converted; task state is NOT updated).
   */
  async downloadWithTask(
    task: Task,
    providerUrl: string,
    orderId: string,
    options?: DownloadOptions,
  ): Promise<{ readonly deliverable: DeliveryResponseOutput; readonly updatedTask: Task }> {
    try {
      const deliverable = await this.download(providerUrl, orderId, options);
      const updatedTask = setTaskState(task, "completed");
      return { deliverable, updatedTask };
    } catch (err) {
      throw toA2AError(task, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Build canonical nonce per IVXP/1.0 spec (32-char hex). */
export function buildNonce(): string {
  return randomBytes(16).toString("hex");
}

/** Build canonical signed_message per IVXP/1.0 spec. */
export function buildSignedMessage(params: {
  readonly orderId: string;
  readonly txHash: string;
  readonly nonce: string;
  readonly timestamp: string;
}): string {
  return (
    `IVXP-DELIVER | Order: ${params.orderId} | ` +
    `Payment: ${params.txHash} | ` +
    `Nonce: ${params.nonce} | ` +
    `Timestamp: ${params.timestamp}`
  );
}

/** Immutably update A2A Task state. */
export function setTaskState(task: Task, state: TaskState): Task {
  return {
    ...task,
    status: {
      ...task.status,
      state,
      timestamp: new Date().toISOString(),
    },
  };
}

/** Convert any error to A2A-compatible error; attach taskId for correlation. */
export function toA2AError(task: Task, err: unknown): A2ATaskError {
  const message =
    err instanceof IVXPError
      ? `IVXP error [${err.code}]: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);

  return new A2ATaskErrorImpl(message, task.id);
}
