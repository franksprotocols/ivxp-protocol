// packages/adapter-langgraph/src/client-adapter.ts

/**
 * IVXPLangGraphClientAdapter -- Wraps IVXPClient for use within LangGraph.
 *
 * Implements the IVXPClientAdapter interface from @ivxp/sdk.
 * Placeholder stub -- full implementation added in v3-3-2.
 */

import type {
  IVXPClientAdapter,
  ServiceRequestParams,
  DownloadOptions,
} from "@ivxp/sdk";
import type {
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  DeliveryAcceptedOutput,
  DeliveryResponseOutput,
  OrderStatusResponseOutput,
  PaymentProofOutput,
  HexSignature,
} from "@ivxp/protocol";

/** IVXP Client Adapter for the LangGraph framework. */
export class IVXPLangGraphClientAdapter implements IVXPClientAdapter {
  async getCatalog(_providerUrl: string): Promise<ServiceCatalogOutput> {
    throw new Error("Not implemented");
  }

  async requestQuote(
    _providerUrl: string,
    _params: ServiceRequestParams,
  ): Promise<ServiceQuoteOutput> {
    throw new Error("Not implemented");
  }

  async requestDelivery(
    _providerUrl: string,
    _orderId: string,
    _paymentProof: PaymentProofOutput,
    _signature: HexSignature,
    _signedMessage: string,
  ): Promise<DeliveryAcceptedOutput> {
    throw new Error("Not implemented");
  }

  async getStatus(
    _providerUrl: string,
    _orderId: string,
  ): Promise<OrderStatusResponseOutput> {
    throw new Error("Not implemented");
  }

  async download(
    _providerUrl: string,
    _orderId: string,
    _options?: DownloadOptions,
  ): Promise<DeliveryResponseOutput> {
    throw new Error("Not implemented");
  }
}
