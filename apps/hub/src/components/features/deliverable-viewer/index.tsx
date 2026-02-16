"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, Loader2, CheckCircle2, AlertTriangle, RefreshCw, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useDeliverable,
  getContentRenderer,
  getFileExtension,
  triggerDownload,
} from "@/hooks/use-deliverable";
import type { OrderStatus } from "@/stores/order-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeliverableViewerProps {
  readonly orderId: string;
  readonly orderStatus: OrderStatus;
}

// ---------------------------------------------------------------------------
// Content renderers
// ---------------------------------------------------------------------------

function decodeText(content: ArrayBuffer): string {
  return new TextDecoder().decode(content);
}

function TextViewer({ content }: { readonly content: ArrayBuffer }) {
  const text = useMemo(() => decodeText(content), [content]);
  return <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-sm">{text}</pre>;
}

function JsonViewer({ content }: { readonly content: ArrayBuffer }) {
  const { formatted, isValid } = useMemo(() => {
    try {
      const parsed = JSON.parse(decodeText(content));
      return { formatted: JSON.stringify(parsed, null, 2), isValid: true };
    } catch {
      return { formatted: decodeText(content), isValid: false };
    }
  }, [content]);

  return (
    <div>
      {!isValid && (
        <Badge variant="destructive" className="mb-2">
          Invalid JSON
        </Badge>
      )}
      <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 font-mono text-sm">
        {formatted}
      </pre>
    </div>
  );
}

function MarkdownViewer({ content }: { readonly content: ArrayBuffer }) {
  const text = useMemo(() => decodeText(content), [content]);
  return (
    <div className="prose prose-sm dark:prose-invert max-h-96 overflow-auto rounded-md bg-muted p-4">
      <pre>{text}</pre>
    </div>
  );
}

function ImageViewer({
  content,
  contentType,
}: {
  readonly content: ArrayBuffer;
  readonly contentType: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([content], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [content, contentType]);

  if (!src) return null;

  return (
    <div className="flex justify-center rounded-md bg-muted p-4">
      <img
        src={src}
        alt="Deliverable preview"
        className="max-h-96 max-w-full rounded object-contain"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hash status badge
// ---------------------------------------------------------------------------

function HashStatusBadge({
  status,
  hash,
}: {
  readonly status: string;
  readonly hash: string | null;
}) {
  if (status === "verified") {
    return (
      <div className="flex items-center gap-2">
        <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Verified
        </Badge>
        {hash && <code className="text-xs text-muted-foreground">{hash.slice(0, 16)}...</code>}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Hash Mismatch
        </Badge>
        {hash && <code className="text-xs text-muted-foreground">{hash.slice(0, 16)}...</code>}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Content display
// ---------------------------------------------------------------------------

function ContentDisplay({
  content,
  contentType,
  orderId,
}: {
  readonly content: ArrayBuffer;
  readonly contentType: string | null;
  readonly orderId: string;
}) {
  const renderer = getContentRenderer(contentType);

  switch (renderer) {
    case "text":
      return <TextViewer content={content} />;
    case "json":
      return <JsonViewer content={content} />;
    case "markdown":
      return <MarkdownViewer content={content} />;
    case "image":
      if (!contentType) return null;
      return <ImageViewer content={content} contentType={contentType} />;
    case "binary":
    default:
      return (
        <div className="flex items-center justify-center rounded-md bg-muted p-8">
          <Button
            variant="outline"
            className="gap-2"
            aria-label="Save file"
            onClick={() => {
              const ext = getFileExtension(contentType);
              const filename = `order-${orderId}.${ext}`;
              triggerDownload(content, filename, contentType ?? "application/octet-stream");
            }}
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Save File
          </Button>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeliverableViewer({ orderId, orderStatus }: DeliverableViewerProps) {
  const {
    content,
    contentType,
    fileName,
    isLoading,
    error,
    hashStatus,
    contentHash,
    retryCount,
    download,
  } = useDeliverable(orderId);

  // Only render for delivered orders
  if (orderStatus !== "delivered") {
    return null;
  }

  const showContent = content !== null && hashStatus === "verified";

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Download className="h-5 w-5" aria-hidden="true" />
          Deliverable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Downloading deliverable...
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1"
              onClick={download}
              aria-label="Retry download"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {retryCount > 0 ? `Retry (attempt ${retryCount})` : "Retry"}
            </Button>
          </div>
        )}

        {/* Download trigger (when no content yet and not loading/error) */}
        {!content && !isLoading && !error && (
          <Button onClick={download} className="gap-2" aria-label="Download deliverable">
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Deliverable
          </Button>
        )}

        {/* Hash verification status */}
        {(hashStatus === "verified" || hashStatus === "failed") && (
          <HashStatusBadge status={hashStatus} hash={contentHash} />
        )}

        {/* Content display */}
        {showContent && (
          <ContentDisplay content={content} contentType={contentType} orderId={orderId} />
        )}

        {/* Save file button for verified content */}
        {showContent && contentType && getContentRenderer(contentType) !== "binary" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            aria-label="Save file"
            onClick={() => {
              const ext = getFileExtension(contentType);
              const name = fileName ?? `order-${orderId}.${ext}`;
              triggerDownload(content, name, contentType);
            }}
          >
            <FileDown className="h-3 w-3" aria-hidden="true" />
            Save File
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
