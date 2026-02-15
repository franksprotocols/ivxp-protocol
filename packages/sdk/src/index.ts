/**
 * @ivxp/sdk
 *
 * Client library for the Intelligence Value Exchange Protocol.
 */

// Crypto module
export {
  CryptoService,
  createCryptoService,
  formatIVXPMessage,
  type IVXPMessageParams,
  type IVXPSignedMessage,
  type IVXPVerifyParams,
  type IVXPVerificationResult,
} from "./crypto/index.js";
