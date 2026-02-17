"use client";

import { useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { RatingForm } from "./RatingForm";
import type { Stars } from "@/lib/ratings/types";
import { buildRatingMessage } from "@/lib/ratings/rating-service";

/** Zod schema for validating the success API response */
const ratingSuccessResponseSchema = z.object({
  success: z.literal(true),
  rating_id: z.string().min(1),
});

/** Zod schema for validating the error API response */
const ratingErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export interface RatingDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orderId: string;
  readonly serviceType: string;
  readonly onSign: (message: string) => Promise<`0x${string}`>;
  readonly onRatingSubmitted?: (ratingId: string) => void;
}

type DialogState =
  | { readonly step: "form" }
  | { readonly step: "signing" }
  | { readonly step: "submitting" }
  | { readonly step: "success"; readonly ratingId: string }
  | { readonly step: "error"; readonly message: string };

/**
 * Rating submission dialog.
 * Handles the full flow: form -> wallet signature -> API call.
 */
export function RatingDialog({
  open,
  onOpenChange,
  orderId,
  serviceType,
  onSign,
  onRatingSubmitted,
}: RatingDialogProps) {
  const [state, setState] = useState<DialogState>({ step: "form" });

  async function handleSubmit(stars: Stars, reviewText?: string) {
    try {
      // 1. Build the message to sign (with timestamp for replay prevention)
      setState({ step: "signing" });
      const timestamp = Date.now();
      const message = buildRatingMessage({
        orderId,
        stars,
        reviewText,
        timestamp,
      });

      // 2. Request wallet signature
      const signature = await onSign(message);

      // 3. Submit to API (include timestamp)
      setState({ step: "submitting" });
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          stars,
          review_text: reviewText,
          signature,
          timestamp,
        }),
      });

      const rawData: unknown = await response.json();

      if (!response.ok) {
        const parsed = ratingErrorResponseSchema.safeParse(rawData);
        const errorMessage = parsed.success
          ? parsed.data.error.message
          : "Failed to submit rating.";
        setState({ step: "error", message: errorMessage });
        return;
      }

      const parsed = ratingSuccessResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        setState({
          step: "error",
          message: "Received an unexpected response from the server.",
        });
        return;
      }

      setState({ step: "success", ratingId: parsed.data.rating_id });
      onRatingSubmitted?.(parsed.data.rating_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      setState({ step: "error", message });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setState({ step: "form" });
    }
    onOpenChange(nextOpen);
  }

  const isLoading = state.step === "signing" || state.step === "submitting";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Service</DialogTitle>
          <DialogDescription>
            Rate your experience with {serviceType} (Order: {orderId.slice(0, 8)}...)
          </DialogDescription>
        </DialogHeader>

        {state.step === "success" ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Rating submitted successfully.</AlertDescription>
          </Alert>
        ) : (
          <>
            {state.step === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            {state.step === "signing" && (
              <p className="text-sm text-muted-foreground">
                Please sign the rating in your wallet...
              </p>
            )}

            <RatingForm
              onSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={state.step === "success"}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
