/**
 * Internal Interface Contracts
 *
 * Re-exports all internal interfaces for dependency injection
 * and parallel module development.
 *
 * These interfaces define the contracts between SDK modules,
 * enabling each module to be developed, tested, and swapped independently.
 */

// Crypto service
export type { ICryptoService } from "./crypto-service.js";

// Payment service
export type {
  IPaymentService,
  PaymentExpectedDetails,
} from "./payment-service.js";

// HTTP client
export type {
  IHttpClient,
  JsonSerializable,
  RequestOptions,
} from "./http-client.js";

// Event emitter
export type {
  IEventEmitter,
  SDKEvent,
  SDKEventMap,
} from "./event-emitter.js";

// Order storage
export type {
  IOrderStorage,
  OrderFilters,
  OrderUpdates,
  StoredOrder,
} from "./order-storage.js";
