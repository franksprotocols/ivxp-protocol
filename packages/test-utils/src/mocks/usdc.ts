/**
 * MockUSDC -- Deployable on-chain ERC-20 mock for Anvil tests.
 *
 * Provides deterministic mint/transfer/balance helpers and transfer
 * verification against transaction logs.
 */

import { type Address, decodeEventLog, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import type { HexAddress } from "@ivxp/protocol";
import type { AnvilTestClient } from "./chain.js";
import { TEST_ACCOUNTS } from "../fixtures/wallets.js";

// ---------------------------------------------------------------------------
// ABI + bytecode (minimal mock ERC-20 with mint/transfer/balanceOf)
// ---------------------------------------------------------------------------

const MOCK_USDC_ABI = [
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

const MOCK_USDC_BYTECODE =
  "0x608060405234801561000f575f80fd5b506105b78061001d5f395ff3fe608060405234801561000f575f80fd5b506004361061003f575f3560e01c806340c10f191461004357806370a082311461005f578063a9059cbb1461008f575b5f80fd5b61005d600480360381019061005891906103b2565b6100bf565b005b610079600480360381019061007491906103f0565b61017a565b604051610086919061042a565b60405180910390f35b6100a960048036038101906100a491906103b2565b61018e565b6040516100b6919061045d565b60405180910390f35b805f808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825461010a91906104a3565b925050819055508173ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161016e919061042a565b60405180910390a35050565b5f602052805f5260405f205f915090505481565b5f815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054101561020e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161020590610530565b60405180910390fd5b815f803373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610259919061054e565b92505081905550815f808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546102ab91906104a3565b925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161030f919061042a565b60405180910390a36001905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61034e82610325565b9050919050565b61035e81610344565b8114610368575f80fd5b50565b5f8135905061037981610355565b92915050565b5f819050919050565b6103918161037f565b811461039b575f80fd5b50565b5f813590506103ac81610388565b92915050565b5f80604083850312156103c8576103c7610321565b5b5f6103d58582860161036b565b92505060206103e68582860161039e565b9150509250929050565b5f6020828403121561040557610404610321565b5b5f6104128482850161036b565b91505092915050565b6104248161037f565b82525050565b5f60208201905061043d5f83018461041b565b92915050565b5f8115159050919050565b61045781610443565b82525050565b5f6020820190506104705f83018461044e565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6104ad8261037f565b91506104b88361037f565b92508282019050808211156104d0576104cf610476565b5b92915050565b5f82825260208201905092915050565b7f696e73756666696369656e7400000000000000000000000000000000000000005f82015250565b5f61051a600c836104d6565b9150610525826104e6565b602082019050919050565b5f6020820190508181035f8301526105478161050e565b9050919050565b5f6105588261037f565b91506105638361037f565b925082820390508181111561057b5761057a610476565b5b9291505056fea2646970667358221220a7883aa0a4fa726985d0dc232d9383ecff7e731ed51852a50abbe7d7875ca13f64736f6c63430008140033" as `0x${string}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockUSDCDeployConfig {
  readonly deployerPrivateKey?: HexAddress;
}

function toAccount(privateKey: HexAddress) {
  return privateKeyToAccount(privateKey as `0x${string}`);
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class MockUSDC {
  public readonly address: Address;
  private readonly testClient: AnvilTestClient;

  private constructor(testClient: AnvilTestClient, address: Address) {
    this.testClient = testClient;
    this.address = address;
  }

  static async deploy(
    testClient: AnvilTestClient,
    config: MockUSDCDeployConfig = {},
  ): Promise<MockUSDC> {
    const deployerKey = config.deployerPrivateKey ?? TEST_ACCOUNTS.deployer.privateKey;
    const deployer = toAccount(deployerKey);

    const txHash = await testClient.deployContract({
      abi: MOCK_USDC_ABI,
      bytecode: MOCK_USDC_BYTECODE,
      account: deployer,
      chain: foundry,
    });

    const receipt = await testClient.waitForTransactionReceipt({ hash: txHash });
    if (!receipt.contractAddress) {
      throw new Error("Failed to deploy MockUSDC contract");
    }

    return new MockUSDC(testClient, receipt.contractAddress);
  }

  async mint(to: Address, amount: bigint): Promise<`0x${string}`> {
    const deployer = toAccount(TEST_ACCOUNTS.deployer.privateKey);
    const txHash = await this.testClient.writeContract({
      address: this.address,
      abi: MOCK_USDC_ABI,
      functionName: "mint",
      args: [to, amount],
      account: deployer,
      chain: foundry,
    });

    await this.testClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async balanceOf(account: Address): Promise<bigint> {
    const value = await this.testClient.readContract({
      address: this.address,
      abi: MOCK_USDC_ABI,
      functionName: "balanceOf",
      args: [account],
    });
    return value as bigint;
  }

  async transferFromPrivateKey(
    fromPrivateKey: HexAddress,
    to: Address,
    amount: bigint,
  ): Promise<`0x${string}`> {
    const sender = toAccount(fromPrivateKey);
    const txHash = await this.testClient.writeContract({
      address: this.address,
      abi: MOCK_USDC_ABI,
      functionName: "transfer",
      args: [to, amount],
      account: sender,
      chain: foundry,
    });

    await this.testClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async verifyTransfer(
    txHash: `0x${string}`,
    expectedTo: Address,
    expectedAmount: bigint,
  ): Promise<boolean> {
    const receipt = await this.testClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") return false;

    const targetAddress = expectedTo.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.address.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({
          abi: MOCK_USDC_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== "Transfer") continue;

        const toValue = decoded.args.to;
        const amountValue = decoded.args.value;
        if (
          typeof toValue === "string" &&
          toValue.toLowerCase() === targetAddress &&
          amountValue === expectedAmount
        ) {
          return true;
        }
      } catch {
        // Ignore non-transfer logs in the same receipt.
      }
    }

    return false;
  }

  async mintDecimal(to: Address, amountUsdc: string): Promise<`0x${string}`> {
    const rawAmount = parseUnits(amountUsdc, 6);
    return this.mint(to, rawAmount);
  }
}
