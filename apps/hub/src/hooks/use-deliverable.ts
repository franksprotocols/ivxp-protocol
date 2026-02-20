import { useState, useCallback, useEffect, useRef } from "react";
import { useIVXPClient } from "./use-ivxp-client";
import { verifyContentHash } from "@/lib/verify-content-hash";
import { useOrderStore } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HashStatus = "idle" | "verifying" | "verified" | "failed";

export interface UseDeliverableReturn {
  readonly content: ArrayBuffer | null;
  readonly contentType: string | null;
  readonly fileName: string | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly hashStatus: HashStatus;
  readonly contentHash: string | null;
  readonly retryCount: number;
  readonly download: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function computeContentHash(content: ArrayBuffer): Promise<string> {
  // Normalize to a Uint8Array view to avoid BufferSource realm issues in CI/jsdom.
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(content));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getContentRenderer(
  contentType: string | null,
): "text" | "markdown" | "json" | "image" | "binary" | "unknown" {
  if (!contentType) return "unknown";
  if (contentType.startsWith("text/markdown")) return "markdown";
  if (contentType === "application/json") return "json";
  if (contentType.startsWith("text/")) return "text";
  if (contentType.startsWith("image/")) return "image";
  return "binary";
}

export function getFileExtension(contentType: string | null): string {
  const map: Record<string, string> = {
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "text/html": "html",
    "text/xml": "xml",
    "application/json": "json",
    "application/xml": "xml",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  if (!contentType) return "bin";
  return map[contentType] ?? "bin";
}

export function triggerDownload(content: ArrayBuffer, filename: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildOutputPreview(buffer: ArrayBuffer, type: string): string {
  if (type.startsWith("text/") || type === "application/json" || type === "application/xml") {
    const text = new TextDecoder().decode(buffer);
    return text.length > 4000 ? `${text.slice(0, 4000)}\n...<truncated>` : text;
  }
  return `[binary:${type}; bytes=${buffer.byteLength}]`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDeliverable(orderId: string): UseDeliverableReturn {
  const client = useIVXPClient();
  const order = useOrderStore((state) => state.orders.find((item) => item.orderId === orderId));
  const updateOrderDeliverable = useOrderStore((state) => state.updateOrderDeliverable);
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hashStatus, setHashStatus] = useState<HashStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const orderIdRef = useRef(orderId);

  // Reset state when orderId changes
  useEffect(() => {
    if (orderIdRef.current !== orderId) {
      orderIdRef.current = orderId;
      setContent(null);
      setContentType(null);
      setFileName(null);
      setContentHash(null);
      setIsLoading(false);
      setError(null);
      setHashStatus("idle");
      setRetryCount(0);
    }
  }, [orderId]);

  const download = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setHashStatus("verifying");

    try {
      const providerUrl =
        order?.providerEndpointUrl ?? process.env.NEXT_PUBLIC_PROVIDER_URL ?? "http://localhost:3001";
      const response = await client.downloadDeliverable(providerUrl, orderId);

      // Verify content hash using shared utility
      const result = await verifyContentHash(response.content, response.contentHash);

      if (result.verified) {
        const resolvedContentType = response.contentType;
        const outputPreview = buildOutputPreview(response.content, resolvedContentType);

        setContent(response.content);
        setContentType(resolvedContentType);
        setFileName(response.fileName ?? null);
        setContentHash(response.contentHash);
        setHashStatus("verified");
        setError(null);
        updateOrderDeliverable(orderId, {
          contentHash: response.contentHash,
          outputPreview,
          outputContentType: resolvedContentType,
        });
        client.emit("order.delivered", {
          orderId,
          contentHash: response.contentHash,
        });
      } else {
        setContent(null);
        setContentType(null);
        setFileName(null);
        setContentHash(response.contentHash);
        setHashStatus("failed");
        setError("Content hash verification failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      setHashStatus("idle");
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [client, orderId, isLoading, order?.providerEndpointUrl, updateOrderDeliverable]);

  return {
    content,
    contentType,
    fileName,
    isLoading,
    error,
    hashStatus,
    contentHash,
    retryCount,
    download,
  };
}
