/**
 * IVXPLangGraphClientAdapter -- Wraps IVXPClient for use within LangGraph.
 *
 * Implements the IVXPClientAdapter interface from @ivxp/sdk, delegating
 * each method to the underlying IVXPClient while converting IVXPError
 * instances into plain Error objects suitable for LangGraph error handling.
 */

import {
  type IVXPClient,
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
  type IHttpClient,
  type PaymentProofOutput,
  type HexSignature,
  type DeliveryAcceptedOutput,
  type JsonSerializable,
} from "@ivxp/protocol";
import { toLangGraphError } from "./errors.js";

/** IVXP Client Adapter for the LangGraph framework. */
export class IVXPLangGraphClientAdapter implements IVXPClientAdapter {
  readonly #client: IVXPClient;
  readonly #httpClient: IHttpClient;

  constructor(client: IVXPClient, httpClient?: IHttpClient) {
    this.#client = client;
    this.#httpClient = httpClient ?? createHttpClient();
  }

  async getCatalog(providerUrl: string): Promise<ServiceCatalogOutput> {
    try {
      return await this.#client.getCatalog(providerUrl);
    } catch (err) {
      throw toLangGraphError(err, "getCatalog");
    }
  }

  async requestQuote(
    providerUrl: string,
    params: ServiceRequestParams,
  ): Promise<ServiceQuoteOutput> {
    try {
      return await this.#client.requestQuote(providerUrl, params);
    } catch (err) {
      throw toLangGraphError(err, "requestQuote");
    }
  }

  async requestDelivery(
    providerUrl: string,
    orderId: string,
    paymentProof: PaymentProofOutput,
    signature: HexSignature,
    signedMessage: string,
  ): Promise<DeliveryAcceptedOutput> {
    try {
      if (!providerUrl || !/^https?:\/\//i.test(providerUrl)) {
        throw new IVXPError(
          `Invalid provider URL: "${providerUrl}" must start with http:// or https://`,
          "INVALID_PROVIDER_URL",
          { url: providerUrl },
        );
      }

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

      const rawResponse = await this.#httpClient.post<unknown>(deliverUrl, body);

      try {
        return DeliveryAcceptedSchema.parse(rawResponse);
      } catch (zodErr) {
        if (zodErr instanceof Error && zodErr.name === "ZodError") {
          throw new Error(`[IVXP:INVALID_RESPONSE] requestDelivery failed: ${zodErr.message}`);
        }
        throw zodErr;
      }
    } catch (err) {
      throw toLangGraphError(err, "requestDelivery");
    }
  }

  async getStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponseOutput> {
    try {
      return await this.#client.getOrderStatus(providerUrl, orderId);
    } catch (err) {
      throw toLangGraphError(err, "getStatus");
    }
  }

  async download(
    providerUrl: string,
    orderId: string,
    options?: DownloadOptions,
  ): Promise<DeliveryResponseOutput> {
    try {
      return await this.#client.downloadDeliverable(providerUrl, orderId, options);
    } catch (err) {
      throw toLangGraphError(err, "download");
    }
  }
}
