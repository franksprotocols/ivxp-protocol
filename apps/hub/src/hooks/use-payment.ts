"use client";

/**
 * usePayment -- Hook managing the multi-step USDC payment flow.
 *
 * State machine: idle -> checking-balance -> approving -> transferring
 *   -> confirming -> confirmed
 * Error states: error, partial-success
 *
 * Uses wagmi v2 hooks for contract interaction and viem for USDC parsing.
 */

import { useState, useCallback, useRef } from "react";
import { type Address, parseUnits, formatUnits } from "viem";
import { useAccount, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { usdcConfig, USDC_DECIMALS, assertUsdcConfigured } from "@/lib/usdc-contract";
import { isSupportedChain, getTargetChain } from "@/lib/network-constants";
import { useOrderStore } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for waitForTransactionReceipt (ms). NFR-4 targets <15s, allow 60s. */
const TX_RECEIPT_TIMEOUT = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentStep =
  | "idle"
  | "checking-balance"
  | "approving"
  | "transferring"
  | "confirming"
  | "confirmed"
  | "error"
  | "partial-success";

export interface PaymentError {
  readonly message: string;
  readonly code: string;
  readonly recoverable: boolean;
}

export interface UsePaymentReturn {
  readonly step: PaymentStep;
  readonly txHash: `0x${string}` | null;
  readonly blockNumber: bigint | null;
  readonly error: PaymentError | null;
  readonly balance: string | null;
  readonly isRetrying: boolean;
  readonly initiatePayment: (providerAddress: Address, amountUsdc: string) => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly retryVerification: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Error classification (Fix #9)
// ---------------------------------------------------------------------------

function classifyError(err: unknown): PaymentError {
  if (!(err instanceof Error)) {
    return { message: "Payment failed", code: "PAYMENT_FAILED", recoverable: true };
  }

  const name = err.name ?? "";
  const message = err.message ?? "";

  // Wallet rejection
  if (
    name === "UserRejectedRequestError" ||
    message.includes("User rejected") ||
    message.includes("user rejected") ||
    message.includes("User denied")
  ) {
    return {
      message: "Transaction rejected in wallet. You can retry when ready.",
      code: "USER_REJECTED",
      recoverable: true,
    };
  }

  // Timeout
  if (message.includes("timed out") || message.includes("timeout") || name === "TimeoutError") {
    return {
      message: "Transaction confirmation timed out. The transaction may still be processing.",
      code: "TIMEOUT",
      recoverable: true,
    };
  }

  return { message: message, code: "PAYMENT_FAILED", recoverable: true };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePayment(orderId: string): UsePaymentReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const updateOrderPayment = useOrderStore((s) => s.updateOrderPayment);

  const [step, setStep] = useState<PaymentStep>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [error, setError] = useState<PaymentError | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Store last payment args for retry
  const lastArgsRef = useRef<{ providerAddress: Address; amountUsdc: string } | null>(null);

  const initiatePayment = useCallback(
    async (providerAddress: Address, amountUsdc: string) => {
      // Fix #6: Set error if wallet not connected
      if (!address) {
        setStep("error");
        setError({
          message: "Please connect your wallet to proceed with payment.",
          code: "WALLET_NOT_CONNECTED",
          recoverable: false,
        });
        return;
      }

      if (!publicClient) {
        setStep("error");
        setError({
          message: "Network client unavailable. Please check your connection.",
          code: "CLIENT_UNAVAILABLE",
          recoverable: false,
        });
        return;
      }

      // Fix #4: Chain validation
      if (!isSupportedChain(chainId)) {
        const target = getTargetChain();
        setStep("error");
        setError({
          message: `Please switch to ${target.name} to make payments.`,
          code: "WRONG_CHAIN",
          recoverable: false,
        });
        return;
      }

      // Fix #1: Validate USDC address is configured
      try {
        assertUsdcConfigured();
      } catch {
        setStep("error");
        setError({
          message: "USDC contract is not configured. Please contact support.",
          code: "USDC_NOT_CONFIGURED",
          recoverable: false,
        });
        return;
      }

      lastArgsRef.current = { providerAddress, amountUsdc };
      setError(null);
      setTxHash(null);
      setBlockNumber(null);

      const amount = parseUnits(amountUsdc, USDC_DECIMALS);

      try {
        // Step 1: Check balance
        setStep("checking-balance");
        const rawBalance = await publicClient.readContract({
          ...usdcConfig,
          functionName: "balanceOf",
          args: [address],
        });
        const currentBalance = rawBalance as bigint;
        setBalance(formatUnits(currentBalance, USDC_DECIMALS));

        if (currentBalance < amount) {
          setStep("error");
          setError({
            message: `Insufficient USDC balance. You have ${formatUnits(currentBalance, USDC_DECIMALS)} USDC but need ${amountUsdc} USDC.`,
            code: "INSUFFICIENT_BALANCE",
            recoverable: false,
          });
          return;
        }

        // Step 2: Check allowance and approve if needed
        setStep("approving");
        const rawAllowance = await publicClient.readContract({
          ...usdcConfig,
          functionName: "allowance",
          args: [address, providerAddress],
        });
        const currentAllowance = rawAllowance as bigint;

        // Fix #5: Approve exact amount needed (standard ERC-20 pattern)
        if (currentAllowance < amount) {
          await writeContractAsync({
            ...usdcConfig,
            functionName: "approve",
            args: [providerAddress, amount],
          });
        }

        // Step 3: Transfer
        setStep("transferring");
        const hash = await writeContractAsync({
          ...usdcConfig,
          functionName: "transfer",
          args: [providerAddress, amount],
        });
        setTxHash(hash);
        updateOrderPayment(orderId, { txHash: hash, status: "paying" });

        // Step 4: Wait for confirmation
        setStep("confirming");
        try {
          // Fix #3: Add timeout to waitForTransactionReceipt
          const receipt = await publicClient.waitForTransactionReceipt({
            hash,
            timeout: TX_RECEIPT_TIMEOUT,
          });

          // Fix #8: Validate receipt status
          if (receipt.status === "reverted") {
            setStep("error");
            setError({
              message: "Transaction was reverted on-chain. The transfer failed.",
              code: "TRANSACTION_REVERTED",
              recoverable: true,
            });
            return;
          }

          const confirmedBlock = receipt.blockNumber;
          setBlockNumber(confirmedBlock);
          setStep("confirmed");
          updateOrderPayment(orderId, { blockNumber: confirmedBlock, status: "paid" });
        } catch (confirmErr) {
          // Transaction sent but confirmation/verification failed
          setStep("partial-success");
          setError({
            message:
              "Payment sent but verification failed. Your transaction was submitted on-chain.",
            code: "PARTIAL_SUCCESS",
            recoverable: true,
          });
        }
      } catch (err) {
        // Fix #9: Classify error for specific codes
        setStep("error");
        setError(classifyError(err));
      }
    },
    [address, chainId, publicClient, writeContractAsync, updateOrderPayment, orderId],
  );

  const retry = useCallback(async () => {
    if (!lastArgsRef.current) return;
    setIsRetrying(true);
    try {
      const { providerAddress, amountUsdc } = lastArgsRef.current;
      await initiatePayment(providerAddress, amountUsdc);
    } finally {
      setIsRetrying(false);
    }
  }, [initiatePayment]);

  const retryVerification = useCallback(async () => {
    if (!txHash || !publicClient) return;
    setIsRetrying(true);
    setStep("confirming");
    setError(null);
    try {
      // Fix #3: Add timeout to retry verification too
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: TX_RECEIPT_TIMEOUT,
      });

      // Fix #8: Validate receipt status on retry too
      if (receipt.status === "reverted") {
        setStep("error");
        setError({
          message: "Transaction was reverted on-chain. The transfer failed.",
          code: "TRANSACTION_REVERTED",
          recoverable: true,
        });
        return;
      }

      const confirmedBlock = receipt.blockNumber;
      setBlockNumber(confirmedBlock);
      setStep("confirmed");
      updateOrderPayment(orderId, { blockNumber: confirmedBlock, status: "paid" });
    } catch {
      setStep("partial-success");
      setError({
        message: "Verification retry failed. Please try again or contact the provider.",
        code: "PARTIAL_SUCCESS",
        recoverable: true,
      });
    } finally {
      setIsRetrying(false);
    }
  }, [txHash, publicClient, updateOrderPayment, orderId]);

  return {
    step,
    txHash,
    blockNumber,
    error,
    balance,
    isRetrying,
    initiatePayment,
    retry,
    retryVerification,
  };
}
