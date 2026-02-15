/**
 * @ivxp/test-utils
 *
 * Shared test utilities, fixtures, and mocks for IVXP packages.
 *
 * Provides:
 * - Test wallet accounts (Anvil defaults)
 * - Order and service fixture factories
 * - Mock implementations of all protocol interfaces
 * - Chain mock utilities for viem/Anvil testing
 * - Assertion and timing helpers
 */

// Fixtures
export {
  // Wallets
  ANVIL_CHAIN_ID,
  ANVIL_RPC_URL,
  MOCK_USDC_ADDRESS,
  TEST_ACCOUNTS,
  type TestAccount,

  // Orders
  createMockDeliveryRequest,
  createMockOrder,
  createMockOrderStatusResponse,
  createMockPaymentProof,
  createMockProviderAgent,
  createMockQuote,
  createMockQuoteDetails,
  DEFAULT_SIGNATURE,
  DEFAULT_TX_HASH,
  generateOrderId,
  resetOrderCounter,

  // Services
  createMockClientAgent,
  createMockServiceCatalog,
  createMockServiceDefinition,
  createMockServiceRequest,
  createMockServiceRequestDetails,
  DEFAULT_SERVICE_DEFINITIONS,
} from "./fixtures/index.js";

// Mocks
export {
  // Crypto
  MockCryptoService,
  type MockCryptoServiceConfig,
  type SignCall,
  type VerifyCall,

  // Payment
  MockPaymentService,
  type MockPaymentServiceConfig,
  type SendCall,
  type PaymentVerifyCall,
  type GetBalanceCall,

  // HTTP
  MockHttpClient,
  type MockHttpClientConfig,
  type HttpGetCall,
  type HttpPostCall,
  type RouteHandler,

  // Order Storage
  MockOrderStorage,
  type MockOrderStorageConfig,
  type CreateOrderCall,
  type GetOrderCall,
  type UpdateOrderCall,
  type ListOrdersCall,
  type DeleteOrderCall,

  // Chain
  createTestChain,
  anvilChain,
  type AnvilTestClient,
  type TestChainConfig,
} from "./mocks/index.js";

// Helpers
export {
  // Wait utilities
  delay,
  flushMicrotasks,
  waitFor,
  type WaitForOptions,

  // Assertions
  assertHexAddress,
  assertHexHash,
  assertOrderIdFormat,
  assertOrderStatus,
  assertProtocolVersion,
  assertValidOrder,
} from "./helpers/index.js";
