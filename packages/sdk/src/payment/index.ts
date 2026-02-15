/**
 * Payment module exports.
 *
 * Provides USDC payment service for Base L2.
 */

export {
  PaymentService,
  createPaymentService,
  type NetworkType,
  type PaymentServiceConfig,
  type PaymentClientOverrides,
} from "./transfer.js";
