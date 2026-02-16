"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UseQuoteExpiryReturn {
  readonly isExpired: boolean;
  readonly isWarning: boolean;
  readonly isCritical: boolean;
  readonly timeRemaining: number;
}

export function useQuoteExpiry(expiresAt: Date): UseQuoteExpiryReturn {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const remaining = expiresAt.getTime() - Date.now();
    if (remaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (expiresAt.getTime() - current.getTime() <= 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const timeRemaining = Math.max(0, expiresAt.getTime() - now.getTime());
  const isExpired = timeRemaining <= 0;
  const isWarning = timeRemaining > 0 && timeRemaining < 60_000;
  const isCritical = timeRemaining > 0 && timeRemaining < 15_000;

  return { isExpired, isWarning, isCritical, timeRemaining };
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface ExpiryCountdownProps {
  readonly timeRemaining: number;
  readonly isExpired: boolean;
  readonly isWarning: boolean;
  readonly isCritical: boolean;
}

export function ExpiryCountdown({
  timeRemaining,
  isExpired,
  isWarning,
  isCritical,
}: ExpiryCountdownProps) {
  if (isExpired) {
    return (
      <div
        data-testid="expiry-countdown"
        data-state="expired"
        className="flex items-center gap-2 text-sm font-medium text-red-600"
        role="status"
        aria-live="assertive"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>Quote Expired</span>
      </div>
    );
  }

  const state = isCritical ? "critical" : isWarning ? "warning" : "normal";

  return (
    <div
      data-testid="expiry-countdown"
      data-state={state}
      className={cn(
        "flex items-center gap-2 text-sm font-medium",
        isCritical && "text-red-600",
        isWarning && !isCritical && "text-amber-600",
        !isWarning && !isCritical && "text-muted-foreground",
      )}
      role="timer"
      aria-live={isCritical ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span>Expires in {formatCountdown(timeRemaining)}</span>
    </div>
  );
}
