/**
 * Crypto module exports.
 *
 * Provides EIP-191 signature service for the IVXP SDK.
 */
export {
  CryptoService,
  createCryptoService,
  formatIVXPMessage,
  type IVXPMessageParams,
  type IVXPSignedMessage,
} from "./signature.js";
