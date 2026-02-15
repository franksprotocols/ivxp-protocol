/**
 * PaymentService unit tests.
 *
 * Tests USDC transfer service using a local Anvil chain.
 * Deploys a mock ERC-20 token to simulate USDC operations.
 *
 * Requires Anvil running on http://127.0.0.1:8545
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  createTestChain,
  TEST_ACCOUNTS,
  ANVIL_RPC_URL,
  type AnvilTestClient,
} from "@ivxp/test-utils";
import type { IPaymentService } from "@ivxp/protocol";
import { parseUnits, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { PaymentService, createPaymentService, type PaymentServiceConfig } from "./transfer.js";
import {
  InsufficientBalanceError,
  TransactionSubmissionError,
  PaymentNotFoundError,
  PaymentAmountMismatchError,
} from "../errors/index.js";

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deploy the mock ERC-20 contract and return its address.
 */
async function deployMockERC20(client: AnvilTestClient): Promise<`0x${string}`> {
  const deployerAccount = privateKeyToAccount(TEST_ACCOUNTS.deployer.privateKey as `0x${string}`);

  const hash = await client.deployContract({
    abi: MOCK_ERC20_ABI,
    bytecode: MOCK_ERC20_BYTECODE,
    account: deployerAccount,
    chain: foundry,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error("Failed to deploy mock ERC-20 contract");
  }

  return receipt.contractAddress;
}

/**
 * Mint mock USDC to an address.
 */
async function mintMockUSDC(
  client: AnvilTestClient,
  contractAddress: `0x${string}`,
  to: `0x${string}`,
  amount: string,
): Promise<void> {
  const deployerAccount = privateKeyToAccount(TEST_ACCOUNTS.deployer.privateKey as `0x${string}`);

  const hash = await client.writeContract({
    address: contractAddress,
    abi: MOCK_ERC20_ABI,
    functionName: "mint",
    args: [to, parseUnits(amount, 6)],
    account: deployerAccount,
    chain: foundry,
  });

  await client.waitForTransactionReceipt({ hash });
}

/**
 * Create a PaymentServiceConfig suitable for testing with Anvil.
 *
 * Uses the public `overrides` config field instead of unsafe type casting.
 * Injects wallet/public clients connected to the local Anvil chain (foundry)
 * and points to the deployed mock ERC-20 contract.
 */
function createTestConfig(
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
function createTestPaymentService(
  privateKey: `0x${string}`,
  mockUsdcAddress: `0x${string}`,
): PaymentService {
  return new PaymentService(createTestConfig(privateKey, mockUsdcAddress));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaymentService", () => {
  let testClient: AnvilTestClient;
  let mockUsdcAddress: `0x${string}`;

  beforeAll(async () => {
    testClient = createTestChain();

    // Deploy mock ERC-20 contract
    mockUsdcAddress = await deployMockERC20(testClient);
  });

  beforeEach(async () => {
    // Mine a block between tests for isolation
    await testClient.mine({ blocks: 1 });
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe("constructor", () => {
    it("should create an instance with valid config", () => {
      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        network: "base-sepolia",
        rpcUrl: ANVIL_RPC_URL,
      });
      expect(service).toBeInstanceOf(PaymentService);
    });

    it("should default to base-sepolia network", () => {
      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
      });
      expect(service).toBeInstanceOf(PaymentService);
    });

    it("should accept overrides for dependency injection", () => {
      const config = createTestConfig(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );
      const service = new PaymentService(config);
      expect(service).toBeInstanceOf(PaymentService);
    });

    it("should throw for invalid private key", () => {
      expect(
        () =>
          new PaymentService({
            privateKey: "0xinvalid" as `0x${string}`,
            rpcUrl: ANVIL_RPC_URL,
          }),
      ).toThrow("Invalid private key");
    });

    it("should throw for empty private key", () => {
      expect(
        () =>
          new PaymentService({
            privateKey: "" as `0x${string}`,
            rpcUrl: ANVIL_RPC_URL,
          }),
      ).toThrow("Invalid private key");
    });

    it("should throw for too-short private key", () => {
      expect(
        () =>
          new PaymentService({
            privateKey: "0xabc" as `0x${string}`,
            rpcUrl: ANVIL_RPC_URL,
          }),
      ).toThrow("Invalid private key");
    });

    it("should throw for invalid rpcUrl", () => {
      expect(
        () =>
          new PaymentService({
            privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
            rpcUrl: "not-a-url",
          }),
      ).toThrow("Invalid rpcUrl");
    });

    it("should accept valid rpcUrl", () => {
      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: "https://rpc.example.com",
      });
      expect(service).toBeInstanceOf(PaymentService);
    });
  });

  // -------------------------------------------------------------------------
  // getAddress
  // -------------------------------------------------------------------------

  describe("getAddress", () => {
    it("should return the correct address for the configured key", () => {
      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
      });
      expect(service.getAddress()).toBe(TEST_ACCOUNTS.client.address);
    });
  });

  // -------------------------------------------------------------------------
  // getBalance
  // -------------------------------------------------------------------------

  describe("getBalance", () => {
    it("should return the USDC balance for an address", async () => {
      // Mint 1000 USDC to the client account
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "1000",
      );

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const balance = await service.getBalance(TEST_ACCOUNTS.client.address as `0x${string}`);
      const balanceNum = parseFloat(balance);
      expect(balanceNum).toBeGreaterThanOrEqual(1000);
    });

    it("should return 0 for an address with no balance", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const emptyAddress = "0x0000000000000000000000000000000000000001" as `0x${string}`;
      const balance = await service.getBalance(emptyAddress);
      expect(balance).toBe("0");
    });

    it("should throw for invalid address format", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(service.getBalance("0xshort" as `0x${string}`)).rejects.toThrow(
        "Invalid address",
      );
    });
  });

  // -------------------------------------------------------------------------
  // send (AC #1, #2, #3)
  // -------------------------------------------------------------------------

  describe("send", () => {
    it("should send USDC successfully and return transaction hash (AC #1, #3)", async () => {
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "1000",
      );

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "10.00");

      // AC #3: Returns transaction hash on success
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should actually transfer USDC to the recipient", async () => {
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "500",
      );

      const providerBalanceBefore = await testClient.readContract({
        address: mockUsdcAddress,
        abi: MOCK_ERC20_ABI,
        functionName: "balanceOf",
        args: [TEST_ACCOUNTS.provider.address as `0x${string}`],
      });

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "25.00");

      const providerBalanceAfter = await testClient.readContract({
        address: mockUsdcAddress,
        abi: MOCK_ERC20_ABI,
        functionName: "balanceOf",
        args: [TEST_ACCOUNTS.provider.address as `0x${string}`],
      });

      const expectedIncrease = parseUnits("25.00", 6);
      expect(providerBalanceAfter - providerBalanceBefore).toBe(expectedIncrease);
    });

    it("should throw InsufficientBalanceError when balance too low (AC #2)", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.thirdParty.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(
        service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "99999.00"),
      ).rejects.toThrow(InsufficientBalanceError);
    });

    it("should include balance details in InsufficientBalanceError", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.thirdParty.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      try {
        await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "99999.00");
        expect.fail("Expected InsufficientBalanceError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientBalanceError);
        if (e instanceof InsufficientBalanceError) {
          expect(e.requiredAmount).toBe("99999.00");
          expect(e.availableBalance).toBeDefined();
          expect(e.code).toBe("INSUFFICIENT_BALANCE");
        }
      }
    });

    it("should throw for invalid recipient address", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(service.send("0xshort" as `0x${string}`, "10.00")).rejects.toThrow(
        "Invalid recipient address",
      );
    });

    it("should throw for invalid amount (negative)", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(
        service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "-10.00"),
      ).rejects.toThrow("Invalid amount");
    });

    it("should throw for invalid amount (not a number)", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(
        service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "not-a-number"),
      ).rejects.toThrow("Invalid amount");
    });

    it("should throw for zero amount", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(
        service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "0"),
      ).rejects.toThrow("Invalid amount");
    });

    it("should wrap RPC errors in TransactionSubmissionError with cause", async () => {
      // Create a service pointing to a non-existent RPC to trigger submission failure
      const badPublicClient = createPublicClient({
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      });

      const badWalletClient = createWalletClient({
        account: privateKeyToAccount(TEST_ACCOUNTS.client.privateKey as `0x${string}`),
        chain: foundry,
        transport: http("http://127.0.0.1:19999"), // unreachable port
      });

      // Mint tokens so balance check passes
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "1000",
      );

      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
        overrides: {
          usdcAddress: mockUsdcAddress,
          publicClient: badPublicClient,
          walletClient: badWalletClient,
        },
      });

      await expect(
        service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "1.00"),
      ).rejects.toThrow(TransactionSubmissionError);
    });

    it("should preserve error cause in TransactionSubmissionError", async () => {
      const badWalletClient = createWalletClient({
        account: privateKeyToAccount(TEST_ACCOUNTS.client.privateKey as `0x${string}`),
        chain: foundry,
        transport: http("http://127.0.0.1:19999"),
      });

      const goodPublicClient = createPublicClient({
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      });

      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "1000",
      );

      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
        overrides: {
          usdcAddress: mockUsdcAddress,
          publicClient: goodPublicClient,
          walletClient: badWalletClient,
        },
      });

      try {
        await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "1.00");
        expect.fail("Expected TransactionSubmissionError");
      } catch (e) {
        expect(e).toBeInstanceOf(TransactionSubmissionError);
        if (e instanceof TransactionSubmissionError) {
          expect(e.cause).toBeDefined();
          expect(e.code).toBe("TRANSACTION_SUBMISSION_FAILED");
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // verify
  // -------------------------------------------------------------------------

  describe("verify", () => {
    it("should verify a successful transfer", async () => {
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "100",
      );

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "5.00");

      const verified = await service.verify(txHash, {
        from: TEST_ACCOUNTS.client.address as `0x${string}`,
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        amount: "5.00",
      });

      expect(verified).toBe(true);
    });

    it("should throw PaymentNotFoundError for non-existent transaction hash", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const fakeTxHash =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

      await expect(
        service.verify(fakeTxHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "10.00",
        }),
      ).rejects.toThrow(PaymentNotFoundError);
    });

    it("should throw PaymentAmountMismatchError when amount does not match", async () => {
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "100",
      );

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "5.00");

      await expect(
        service.verify(txHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "99.00", // Wrong amount
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });

    it("should return false when sender does not match", async () => {
      await mintMockUSDC(
        testClient,
        mockUsdcAddress,
        TEST_ACCOUNTS.client.address as `0x${string}`,
        "100",
      );

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "5.00");

      const verified = await service.verify(txHash, {
        from: TEST_ACCOUNTS.thirdParty.address as `0x${string}`, // Wrong sender
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        amount: "5.00",
      });

      expect(verified).toBe(false);
    });

    it("should re-throw system errors instead of returning false", async () => {
      // Create a service pointing to an unreachable RPC
      const badPublicClient = createPublicClient({
        chain: foundry,
        transport: http("http://127.0.0.1:19999"),
      });

      const service = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
        overrides: {
          usdcAddress: mockUsdcAddress,
          publicClient: badPublicClient,
          walletClient: createWalletClient({
            account: privateKeyToAccount(TEST_ACCOUNTS.client.privateKey as `0x${string}`),
            chain: foundry,
            transport: http(ANVIL_RPC_URL),
          }),
        },
      });

      const fakeTxHash =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

      // Should throw (not return false) because the RPC is unreachable
      await expect(
        service.verify(fakeTxHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "1.00",
        }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // IPaymentService compliance (AC #4)
  // -------------------------------------------------------------------------

  describe("IPaymentService compliance (AC #4)", () => {
    it("should satisfy the IPaymentService interface", () => {
      const service: IPaymentService = new PaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
      });
      expect(service.send).toBeTypeOf("function");
      expect(service.verify).toBeTypeOf("function");
      expect(service.getBalance).toBeTypeOf("function");
    });
  });

  // -------------------------------------------------------------------------
  // createPaymentService factory
  // -------------------------------------------------------------------------

  describe("createPaymentService", () => {
    it("should create a service that implements IPaymentService", () => {
      const service: IPaymentService = createPaymentService({
        privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        rpcUrl: ANVIL_RPC_URL,
      });
      expect(service.send).toBeTypeOf("function");
      expect(service.verify).toBeTypeOf("function");
      expect(service.getBalance).toBeTypeOf("function");
    });

    it("should throw for invalid private key", () => {
      expect(() =>
        createPaymentService({
          privateKey: "0xbad" as `0x${string}`,
          rpcUrl: ANVIL_RPC_URL,
        }),
      ).toThrow("Invalid private key");
    });
  });
});
