/**
 * Integration test environment setup for crypto and payment modules.
 *
 * Provides shared helpers for deploying a mock ERC-20 contract to a local
 * Anvil chain, minting tokens, and creating configured service instances.
 *
 * Follows existing patterns from transfer.test.ts and verify.test.ts.
 */

import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  createTestChain,
  TEST_ACCOUNTS,
  ANVIL_RPC_URL,
  type AnvilTestClient,
} from "@ivxp/test-utils";
import { CryptoService } from "../../crypto/signature.js";
import { PaymentService, type PaymentServiceConfig } from "../../payment/transfer.js";

// ---------------------------------------------------------------------------
// Mock ERC-20 contract (minimal USDC simulation)
// ---------------------------------------------------------------------------

/**
 * Minimal ERC-20 for testing. Supports balanceOf, transfer, mint.
 *
 * Solidity source (compiled with solc 0.8.20 via Forge):
 *
 *   contract MockERC20 {
 *     mapping(address => uint256) public balanceOf;
 *     event Transfer(address indexed from, address indexed to, uint256 value);
 *     function transfer(address to, uint256 amount) external returns (bool) {
 *       require(balanceOf[msg.sender] >= amount, "insufficient");
 *       balanceOf[msg.sender] -= amount;
 *       balanceOf[to] += amount;
 *       emit Transfer(msg.sender, to, amount);
 *       return true;
 *     }
 *     function mint(address to, uint256 amount) external {
 *       balanceOf[to] += amount;
 *       emit Transfer(address(0), to, amount);
 *     }
 *   }
 */
const MOCK_ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

// Bytecode compiled from the Solidity source using solc 0.8.20 via Forge.
const MOCK_ERC20_BYTECODE =
  "0x608060405234801561000f575f80fd5b506105b78061001d5f395ff3fe608060405234801561000f575f80fd5b506004361061003f575f3560e01c806340c10f191461004357806370a082311461005f578063a9059cbb1461008f575b5f80fd5b61005d600480360381019061005891906103b2565b6100bf565b005b610079600480360381019061007491906103f0565b61017a565b604051610086919061042a565b60405180910390f35b6100a960048036038101906100a491906103b2565b61018e565b6040516100b6919061045d565b60405180910390f35b805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825461010a91906104a3565b925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161016e919061042a565b60405180910390a35050565b5f602052805f5260405f205f915090505481565b5f815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054101561020e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020590610530565b60405180910390fd5b815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610259919061054e565b92505081905550815f808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546102ab91906104a3565b925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161030f919061042a565b60405180910390a36001905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61034e82610325565b9050919050565b61035e81610344565b8114610368575f80fd5b50565b5f8135905061037981610355565b92915050565b5f819050919050565b6103918161037f565b811461039b575f80fd5b50565b5f813590506103ac81610388565b92915050565b5f80604083850312156103c8576103c7610321565b5b5f6103d58582860161036b565b92505060206103e68582860161039e565b9150509250929050565b5f6020828403121561040557610404610321565b5b5f6104128482850161036b565b91505092915050565b6104248161037f565b82525050565b5f60208201905061043d5f83018461041b565b92915050565b5f8115159050919050565b61045781610443565b82525050565b5f6020820190506104705f83018461044e565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6104ad8261037f565b91506104b88361037f565b92508282019050808211156104d0576104cf610476565b5b92915050565b5f82825260208201905092915050565b7f696e73756666696369656e7400000000000000000000000000000000000000005f82015250565b5f61051a600c836104d6565b9150610525826104e6565b602082019050919050565b5f6020820190508181035f8301526105478161050e565b9050919050565b5f6105588261037f565b91506105638361037f565b925082820390508181111561057b5761057a610476565b5b9291505056fea2646970667358221220a7883aa0a4fa726985d0dc232d9383ecff7e731ed51852a50abbe7d7875ca13f64736f6c63430008140033" as `0x${string}`;

// ---------------------------------------------------------------------------
// Test environment type
// ---------------------------------------------------------------------------

/**
 * The shared test environment for integration tests.
 *
 * Provides pre-configured Anvil client, mock USDC address, and service
 * instances. All values are readonly to enforce immutability.
 */
export interface IntegrationTestEnv {
  /** Anvil test client with public, wallet, and test actions. */
  readonly testClient: AnvilTestClient;
  /** Address of the deployed mock USDC ERC-20 contract. */
  readonly mockUsdcAddress: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Validate and cast a private key string to a typed hex literal.
 *
 * Performs runtime validation that the key is a 0x-prefixed 64-hex-char
 * string (32 bytes) before returning the narrowed type.
 *
 * @param key - The raw private key string to validate
 * @param label - Human-readable label for error messages (e.g. "deployer")
 * @returns The validated key cast to `0x${string}`
 * @throws If the key does not match the expected format
 */
function validatePrivateKey(key: string, label: string): `0x${string}` {
  if (!PRIVATE_KEY_REGEX.test(key)) {
    throw new Error(
      `Invalid ${label} private key: expected 0x-prefixed 64-char hex string, got "${key.slice(0, 10)}..."`,
    );
  }
  return key as `0x${string}`;
}

// ---------------------------------------------------------------------------
// Shared deployer account
// ---------------------------------------------------------------------------

/**
 * Get the deployer account derived from TEST_ACCOUNTS.deployer.
 *
 * Validates the private key at runtime and returns a viem PrivateKeyAccount.
 * Extracted as a shared helper to avoid duplicating the account creation
 * logic in deployMockERC20 and mintMockUSDC (DRY).
 */
function getDeployerAccount() {
  const deployerKey = validatePrivateKey(TEST_ACCOUNTS.deployer.privateKey, "deployer");
  return privateKeyToAccount(deployerKey);
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Deploy the mock ERC-20 contract and return its address.
 */
export async function deployMockERC20(client: AnvilTestClient): Promise<`0x${string}`> {
  const deployerAccount = getDeployerAccount();

  const hash = await client.deployContract({
    abi: MOCK_ERC20_ABI,
    bytecode: MOCK_ERC20_BYTECODE,
    account: deployerAccount,
    chain: foundry,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error(
      `Failed to deploy mock ERC-20 contract: txHash=${hash}, status=${receipt.status}, gasUsed=${receipt.gasUsed}`,
    );
  }

  return receipt.contractAddress;
}

/**
 * Mint mock USDC to an address.
 */
export async function mintMockUSDC(
  client: AnvilTestClient,
  contractAddress: `0x${string}`,
  to: `0x${string}`,
  amount: string,
): Promise<void> {
  const deployerAccount = getDeployerAccount();

  const hash = await client.writeContract({
    address: contractAddress,
    abi: MOCK_ERC20_ABI,
    functionName: "mint",
    args: [to, parseUnits(amount, 6)],
    account: deployerAccount,
    chain: foundry,
  });

  await client.waitForTransactionReceipt({ hash });

  // Mine an explicit block to ensure the mint is fully confirmed and
  // the new balance is visible to subsequent read operations.
  await client.mine({ blocks: 1 });
}

/**
 * Create a PaymentServiceConfig suitable for testing with Anvil.
 *
 * Uses the public `overrides` config field to inject wallet/public clients
 * connected to the local Anvil chain (foundry) and points to the deployed
 * mock ERC-20 contract.
 *
 * NOTE: The `network` is set to "base-sepolia" because PaymentService requires
 * a valid network value, but the actual chain used is `foundry` (Anvil) via
 * the `overrides.walletClient` and `overrides.publicClient` fields. The
 * overrides take precedence over the network-derived clients, so the
 * "base-sepolia" value is only used for USDC address resolution, which is
 * itself overridden by `overrides.usdcAddress`.
 */
export function createTestPaymentConfig(
  privateKey: `0x${string}`,
  mockUsdcAddress: `0x${string}`,
): PaymentServiceConfig {
  const account = privateKeyToAccount(privateKey);

  return {
    privateKey,
    network: "base-sepolia",
    rpcUrl: ANVIL_RPC_URL,
    overrides: {
      usdcAddress: mockUsdcAddress,
      walletClient: createWalletClient({
        account,
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      }),
      publicClient: createPublicClient({
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      }),
    },
  };
}

/**
 * Create a PaymentService for testing using dependency injection.
 */
export function createTestPaymentService(
  privateKey: `0x${string}`,
  mockUsdcAddress: `0x${string}`,
): PaymentService {
  return new PaymentService(createTestPaymentConfig(privateKey, mockUsdcAddress));
}

/**
 * Create a CryptoService for testing.
 *
 * Validates the private key at runtime before constructing.
 */
export function createTestCryptoService(privateKey: `0x${string}`): CryptoService {
  validatePrivateKey(privateKey, "crypto service");
  return new CryptoService(privateKey);
}

/**
 * Set up the full integration test environment.
 *
 * Creates an Anvil test client, deploys the mock ERC-20 contract, and
 * returns the shared environment object.
 */
export async function setupTestEnvironment(): Promise<IntegrationTestEnv> {
  const testClient = createTestChain();
  const mockUsdcAddress = await deployMockERC20(testClient);

  return {
    testClient,
    mockUsdcAddress,
  };
}
