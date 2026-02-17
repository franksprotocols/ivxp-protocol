"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";

type CopyState = "idle" | "copied" | "failed";

interface CopyButtonProps {
  readonly value: string;
  readonly label?: string;
  readonly className?: string;
}

/**
 * Reusable copy-to-clipboard button with visual feedback.
 * Shows a checkmark for 2 seconds after successful copy,
 * or an X icon for 2 seconds on failure.
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    const nextState: CopyState = ok ? "copied" : "failed";
    setState(nextState);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setState("idle"), 2000);
  }, [value]);

  const ariaLabel =
    state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : `Copy ${label ?? "value"}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={className ?? "h-6 px-2"}
      aria-label={ariaLabel}
    >
      {state === "copied" ? (
        <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
      ) : state === "failed" ? (
        <X className="h-3 w-3 text-red-500" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </Button>
  );
}
