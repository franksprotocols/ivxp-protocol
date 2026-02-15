/**
 * Payment verification unit tests.
 *
 * Tests on-chain USDC payment verification using a local Anvil chain.
 * Deploys a mock ERC-20 token to simulate USDC transfer verification,
 * including specific error types for each failure mode.
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
import { parseUnits, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { PaymentService, type PaymentServiceConfig } from "./transfer.js";
import {
  IVXPError,
  PaymentNotFoundError,
  PaymentPendingError,
  PaymentFailedError,
  PaymentAmountMismatchError,
} from "../errors/index.js";

// ---------------------------------------------------------------------------
// Mock ERC-20 contract (minimal USDC simulation)
// ---------------------------------------------------------------------------

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

const MOCK_ERC20_BYTECODE =
  "0x608060405234801561000f575f80fd5b506105b78061001d5f395ff3fe608060405234801561000f575f80fd5b506004361061003f575f3560e01c806340c10f191461004357806370a082311461005f578063a9059cbb1461008f575b5f80fd5b61005d600480360381019061005891906103b2565b6100bf565b005b610079600480360381019061007491906103f0565b61017a565b604051610086919061042a565b60405180910390f35b6100a960048036038101906100a491906103b2565b61018e565b6040516100b6919061045d565b60405180910390f35b805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825461010a91906104a3565b925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161016e919061042a565b60405180910390a35050565b5f602052805f5260405f205f915090505481565b5f815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054101561020e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020590610530565b60405180910390fd5b815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610259919061054e565b92505081905550815f808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546102ab91906104a3565b925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161030f919061042a565b60405180910390a36001905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61034e82610325565b9050919050565b61035e81610344565b8114610368575f80fd5b50565b5f8135905061037981610355565b92915050565b5f819050919050565b6103918161037f565b811461039b575f80fd5b50565b5f813590506103ac81610388565b92915050565b5f80604083850312156103c8576103c7610321565b5b5f6103d58582860161036b565b92505060206103e68582860161039e565b9150509250929050565b5f6020828403121561040557610404610321565b5b5f6104128482850161036b565b91505092915050565b6104248161037f565b82525050565b5f60208201905061043d5f83018461041b565b92915050565b5f8115159050919050565b61045781610443565b82525050565b5f6020820190506104705f83018461044e565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6104ad8261037f565b91506104b88361037f565b92508282019050808211156104d0576104cf610476565b5b92915050565b5f82825260208201905092915050565b7f696e73756666696369656e7400000000000000000000000000000000000000005f82015250565b5f61051a600c836104d6565b9150610525826104e6565b602082019050919050565b5f6020820190508181035f8301526105478161050e565b9050919050565b5f6105588261037f565b91506105638361037f565b925082820390508181111561057b5761057a610476565b5b9291505056fea2646970667358221220a7883aa0a4fa726985d0dc232d9383ecff7e731ed51852a50abbe7d7875ca13f64736f6c63430008140033" as `0x${string}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function createTestPaymentService(
  privateKey: `0x${string}`,
  mockUsdcAddress: `0x${string}`,
): PaymentService {
  return new PaymentService(createTestConfig(privateKey, mockUsdcAddress));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaymentService.verify (Story 2-4)", () => {
  let testClient: AnvilTestClient;
  let mockUsdcAddress: `0x${string}`;

  beforeAll(async () => {
    testClient = createTestChain();
    mockUsdcAddress = await deployMockERC20(testClient);
  });

  beforeEach(async () => {
    await testClient.mine({ blocks: 1 });
  });

  // -------------------------------------------------------------------------
  // AC #1: Successful verification
  // -------------------------------------------------------------------------

  describe("successful verification (AC #1)", () => {
    it("should return true when all conditions match", async () => {
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

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "10.00");

      const verified = await service.verify(txHash, {
        from: TEST_ACCOUNTS.client.address as `0x${string}`,
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        amount: "10.00",
      });

      expect(verified).toBe(true);
    });

    it("should return true for fractional USDC amounts", async () => {
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

      const txHash = await service.send(
        TEST_ACCOUNTS.provider.address as `0x${string}`,
        "0.123456",
      );

      const verified = await service.verify(txHash, {
        from: TEST_ACCOUNTS.client.address as `0x${string}`,
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        amount: "0.123456",
      });

      expect(verified).toBe(true);
    });

    it("should handle case-insensitive address comparison", async () => {
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
        from: TEST_ACCOUNTS.client.address.toLowerCase() as `0x${string}`,
        to: TEST_ACCOUNTS.provider.address.toLowerCase() as `0x${string}`,
        amount: "5.00",
      });

      expect(verified).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AC #2: Specific errors for failure modes
  // -------------------------------------------------------------------------

  describe("failure mode errors (AC #2)", () => {
    it("should throw PaymentNotFoundError for non-existent transaction", async () => {
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

    it("should include tx hash in PaymentNotFoundError message", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const fakeTxHash =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

      try {
        await service.verify(fakeTxHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "10.00",
        });
        expect.fail("Expected PaymentNotFoundError");
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentNotFoundError);
        if (e instanceof PaymentNotFoundError) {
          expect(e.code).toBe("PAYMENT_NOT_FOUND");
          expect(e.message).toContain(fakeTxHash);
        }
      }
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

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "10.00");

      await expect(
        service.verify(txHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "20.00",
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });

    it("should include expected and actual amounts in PaymentAmountMismatchError", async () => {
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

      const txHash = await service.send(TEST_ACCOUNTS.provider.address as `0x${string}`, "10.00");

      try {
        await service.verify(txHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "20.00",
        });
        expect.fail("Expected PaymentAmountMismatchError");
      } catch (e) {
        expect(e).toBeInstanceOf(PaymentAmountMismatchError);
        if (e instanceof PaymentAmountMismatchError) {
          expect(e.expectedAmount).toBe("20.00");
          expect(e.actualAmount).toBe("10");
          expect(e.code).toBe("PAYMENT_AMOUNT_MISMATCH");
        }
      }
    });

    it("should throw PaymentNotFoundError when no USDC transfer found in tx", async () => {
      // Send a plain ETH transaction (no USDC transfer event)
      const clientAccount = privateKeyToAccount(TEST_ACCOUNTS.client.privateKey as `0x${string}`);

      const walletClient = createWalletClient({
        account: clientAccount,
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      });

      const ethTxHash = await walletClient.sendTransaction({
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        value: 1n,
        chain: foundry,
      });

      const publicClient = createPublicClient({
        chain: foundry,
        transport: http(ANVIL_RPC_URL),
      });
      await publicClient.waitForTransactionReceipt({ hash: ethTxHash });

      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      await expect(
        service.verify(ethTxHash, {
          from: TEST_ACCOUNTS.client.address as `0x${string}`,
          to: TEST_ACCOUNTS.provider.address as `0x${string}`,
          amount: "10.00",
        }),
      ).rejects.toThrow(PaymentNotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // AC #3: Verifies sender, recipient, amount, and token
  // -------------------------------------------------------------------------

  describe("detail verification (AC #3)", () => {
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
        from: TEST_ACCOUNTS.thirdParty.address as `0x${string}`,
        to: TEST_ACCOUNTS.provider.address as `0x${string}`,
        amount: "5.00",
      });

      expect(verified).toBe(false);
    });

    it("should return false when recipient does not match", async () => {
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
        to: TEST_ACCOUNTS.thirdParty.address as `0x${string}`,
        amount: "5.00",
      });

      expect(verified).toBe(false);
    });

    it("should throw PaymentAmountMismatchError when amount is wrong", async () => {
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
          amount: "99.00",
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });
  });

  // -------------------------------------------------------------------------
  // AC #4: Handles pending and failed transactions
  // -------------------------------------------------------------------------

  describe("pending and failed transactions (AC #4)", () => {
    // Note: Testing PaymentPendingError is complex because Anvil auto-mines.
    // We verify the error class structure instead.
    it("should have PaymentPendingError with correct error code", () => {
      const error = new PaymentPendingError("Transaction is pending");
      expect(error.code).toBe("PAYMENT_PENDING");
      expect(error.name).toBe("PaymentPendingError");
      expect(error.message).toBe("Transaction is pending");
    });

    it("should have PaymentFailedError with correct error code and txHash", () => {
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const error = new PaymentFailedError("Transaction reverted", txHash);
      expect(error.code).toBe("PAYMENT_FAILED");
      expect(error.name).toBe("PaymentFailedError");
      expect(error.txHash).toBe(txHash);
    });
  });

  // -------------------------------------------------------------------------
  // getTransactionStatus
  // -------------------------------------------------------------------------

  describe("getTransactionStatus", () => {
    it("should return 'success' status for a confirmed transaction", async () => {
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

      // Mine additional blocks to get confirmations
      await testClient.mine({ blocks: 2 });

      const status = await service.getTransactionStatus(txHash);

      expect(status.status).toBe("success");
      expect(status.blockNumber).toBeDefined();
      expect(typeof status.confirmations).toBe("number");
      expect(status.confirmations).toBeGreaterThanOrEqual(1);
    });

    it("should return 'not_found' for non-existent transaction", async () => {
      const service = createTestPaymentService(
        TEST_ACCOUNTS.client.privateKey as `0x${string}`,
        mockUsdcAddress,
      );

      const fakeTxHash =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

      const status = await service.getTransactionStatus(fakeTxHash);
      expect(status.status).toBe("not_found");
      expect(status.blockNumber).toBeUndefined();
      expect(status.confirmations).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // System error re-throw
  // -------------------------------------------------------------------------

  describe("system error handling", () => {
    it("should re-throw system errors instead of returning false", async () => {
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
  // Error class hierarchy
  // -------------------------------------------------------------------------

  describe("error class hierarchy", () => {
    it("PaymentNotFoundError should extend IVXPError", () => {
      const error = new PaymentNotFoundError("not found");
      expect(error).toBeInstanceOf(IVXPError);
      expect(error).toBeInstanceOf(Error);
    });

    it("PaymentPendingError should extend IVXPError", () => {
      const error = new PaymentPendingError("pending");
      expect(error).toBeInstanceOf(IVXPError);
      expect(error).toBeInstanceOf(Error);
    });

    it("PaymentFailedError should extend IVXPError", () => {
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
      const error = new PaymentFailedError("failed", txHash);
      expect(error).toBeInstanceOf(IVXPError);
      expect(error).toBeInstanceOf(Error);
    });

    it("PaymentAmountMismatchError should extend IVXPError", () => {
      const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
      expect(error).toBeInstanceOf(IVXPError);
      expect(error).toBeInstanceOf(Error);
    });

    it("all payment errors should support error cause chain", () => {
      const cause = new Error("root");
      const txHash =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

      const notFound = new PaymentNotFoundError("msg", cause);
      expect(notFound.cause).toBe(cause);

      const pending = new PaymentPendingError("msg", cause);
      expect(pending.cause).toBe(cause);

      const failed = new PaymentFailedError("msg", txHash, cause);
      expect(failed.cause).toBe(cause);

      const mismatch = new PaymentAmountMismatchError("msg", "10", "5", cause);
      expect(mismatch.cause).toBe(cause);
    });
  });
});
