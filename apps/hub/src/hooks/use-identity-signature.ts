"use client";

/**
 * useIdentitySignature -- Hook managing EIP-191 identity signing and delivery request.
 *
 * State machine: idle -> signing -> signed -> submitting -> submitted
 * Error states: error (with preserved signature for delivery retry)
 *
 * Uses wagmi v2 useSignMessage for gasless EIP-191 personal_sign.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { requestDelivery, type ValidNetwork } from "@/lib/api/delivery";
import { useOrderStore } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignatureStep = "idle" | "signing" | "signed" | "submitting" | "submitted" | "error";

/** Error codes for programmatic detection (issue #13). */
export const SIGNATURE_ERROR_CODES = {
  WALLET_DISCONNECTED: "WALLET_DISCONNECTED",
  USER_REJECTED: "USER_REJECTED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  SIGNING_FAILED: "SIGNING_FAILED",
} as const;

export type SignatureErrorCode = (typeof SIGNATURE_ERROR_CODES)[keyof typeof SIGNATURE_ERROR_CODES];

export interface UseIdentitySignatureParams {
  readonly orderId: string;
  readonly txHash: `0x${string}`;
  readonly network?: ValidNetwork;
}

export interface UseIdentitySignatureReturn {
  readonly step: SignatureStep;
  readonly signature: `0x${string}` | null;
  readonly error: string | null;
  readonly errorCode: SignatureErrorCode | null;
  readonly message: string | null;
  readonly signAndDeliver: () => Promise<void>;
  readonly retryDelivery: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Use millisecond timestamp for message uniqueness across rapid signatures. */
function buildSignatureMessage(orderId: string, address: string): string {
  const timestamp = Date.now();
  return `IVXP Identity Verification | Order: ${orderId} | Address: ${address} | Timestamp: ${timestamp}`;
}

function isUserRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name ?? "";
  const message = err.message ?? "";
  return (
    name === "UserRejectedRequestError" ||
    message.includes("User rejected") ||
    message.includes("user rejected") ||
    message.includes("User denied")
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIdentitySignature({
  orderId,
  txHash,
  network = "base-sepolia",
}: UseIdentitySignatureParams): UseIdentitySignatureReturn {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const updateOrderSignature = useOrderStore((s) => s.updateOrderSignature);

  const [step, setStep] = useState<SignatureStep>("idle");
  const [signature, setSignature] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SignatureErrorCode | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Preserve signature + message for delivery retry
  const savedRef = useRef<{
    signature: `0x${string}`;
    message: string;
  } | null>(null);

  // Issue #11: Double-click guard
  const isProcessingRef = useRef(false);

  // Issue #9: Keep refs to latest values so callbacks always read current state
  // without needing them in dependency arrays.
  const addressRef = useRef(address);
  addressRef.current = address;
  const stepRef = useRef(step);
  stepRef.current = step;

  // Issue #12: Clear savedRef when orderId changes; reset processing guard on unmount
  useEffect(() => {
    savedRef.current = null;
    setStep("idle");
    setSignature(null);
    setError(null);
    setErrorCode(null);
    setMessage(null);

    return () => {
      isProcessingRef.current = false;
    };
  }, [orderId]);

  const submitDelivery = useCallback(
    async (sig: `0x${string}`, msg: string) => {
      // Issue #3/#9: Read latest address from ref to detect mid-flow disconnection
      const currentAddress = addressRef.current;
      if (!currentAddress) {
        setStep("error");
        setError("Wallet disconnected during signing. Please reconnect.");
        setErrorCode(SIGNATURE_ERROR_CODES.WALLET_DISCONNECTED);
        return;
      }

      setStep("submitting");
      setError(null);
      setErrorCode(null);

      try {
        await requestDelivery({
          order_id: orderId,
          payment: {
            tx_hash: txHash,
            network,
          },
          signature: {
            message: msg,
            sig,
            signer: currentAddress,
          },
        });

        setStep("submitted");
        updateOrderSignature(orderId, {
          signature: sig,
          signedMessage: msg,
          signatureVerified: true,
          status: "processing",
        });
        router.push(`/orders/${orderId}`);
      } catch (err) {
        setStep("error");
        const errorMessage = err instanceof Error ? err.message : "Delivery request failed";
        setError(errorMessage);
        setErrorCode(SIGNATURE_ERROR_CODES.DELIVERY_FAILED);
      }
    },
    [orderId, txHash, network, updateOrderSignature, router],
  );

  const signAndDeliver = useCallback(async () => {
    // Issue #11: Prevent concurrent calls; also guard against non-idle state
    const currentStep = stepRef.current;
    if (isProcessingRef.current || (currentStep !== "idle" && currentStep !== "error")) return;

    if (!orderId || orderId.trim() === "") {
      setStep("error");
      setError("Invalid order ID.");
      setErrorCode(SIGNATURE_ERROR_CODES.SIGNING_FAILED);
      return;
    }

    if (!address) {
      setStep("error");
      setError("Wallet not connected.");
      setErrorCode(SIGNATURE_ERROR_CODES.WALLET_DISCONNECTED);
      return;
    }

    isProcessingRef.current = true;
    setStep("signing");
    setError(null);
    setErrorCode(null);

    const msg = buildSignatureMessage(orderId, address);
    setMessage(msg);

    try {
      const sig = await signMessageAsync({ message: msg });
      setSignature(sig);
      savedRef.current = { signature: sig, message: msg };

      setStep("signed");
      await submitDelivery(sig, msg);
    } catch (err) {
      if (isUserRejection(err)) {
        setStep("error");
        setError("Signature rejected. You can retry without paying again.");
        setErrorCode(SIGNATURE_ERROR_CODES.USER_REJECTED);
      } else {
        setStep("error");
        const errorMessage = err instanceof Error ? err.message : "Signing failed";
        setError(errorMessage);
        setErrorCode(SIGNATURE_ERROR_CODES.SIGNING_FAILED);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [address, orderId, signMessageAsync, submitDelivery]);

  const retryDelivery = useCallback(async () => {
    if (!savedRef.current) return;
    // Issue #11: Prevent concurrent calls
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    try {
      const { signature: sig, message: msg } = savedRef.current;
      await submitDelivery(sig, msg);
    } finally {
      isProcessingRef.current = false;
    }
  }, [submitDelivery]);

  return useMemo(
    () => ({
      step,
      signature,
      error,
      errorCode,
      message,
      signAndDeliver,
      retryDelivery,
    }),
    [step, signature, error, errorCode, message, signAndDeliver, retryDelivery],
  );
}
