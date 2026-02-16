/**
 * PaymentSteps -- Visual step progress indicator for the payment flow.
 *
 * Shows a horizontal stepper with icons and labels for each payment phase.
 * The current step is highlighted, completed steps show a checkmark,
 * and future steps are dimmed.
 */

import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import type { PaymentStep } from "@/hooks/use-payment";

interface PaymentStepsProps {
  readonly currentStep: PaymentStep;
}

interface StepDef {
  readonly key: string;
  readonly label: string;
  readonly matchSteps: readonly PaymentStep[];
}

const STEPS: readonly StepDef[] = [
  { key: "balance", label: "Check Balance", matchSteps: ["checking-balance"] },
  { key: "approve", label: "Approve USDC", matchSteps: ["approving"] },
  { key: "transfer", label: "Transfer USDC", matchSteps: ["transferring"] },
  { key: "confirm", label: "Confirm Payment", matchSteps: ["confirming"] },
  { key: "done", label: "Complete", matchSteps: ["confirmed"] },
] as const;

function getStepStatus(
  stepDef: StepDef,
  currentStep: PaymentStep,
  stepIndex: number,
): "completed" | "active" | "pending" | "error" {
  if (currentStep === "error" || currentStep === "partial-success") {
    // Find which step was active when error occurred
    const activeIdx = STEPS.findIndex((s) => s.matchSteps.includes(currentStep));
    if (activeIdx === -1) {
      // Error/partial-success doesn't match any step; mark all prior as completed
      return stepIndex < STEPS.length ? "pending" : "pending";
    }
  }

  const isActive = stepDef.matchSteps.includes(currentStep);
  if (isActive) return "active";

  // Determine ordering: steps before the current one are completed
  const currentIdx = STEPS.findIndex((s) => s.matchSteps.includes(currentStep));
  if (currentIdx === -1) {
    // idle or error states
    if (currentStep === "confirmed") return stepIndex <= 4 ? "completed" : "pending";
    return "pending";
  }

  if (stepIndex < currentIdx) return "completed";
  return "pending";
}

function StepIcon({ status }: { readonly status: "completed" | "active" | "pending" | "error" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />;
    case "active":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-muted-foreground/40" aria-hidden="true" />;
  }
}

export function PaymentSteps({ currentStep }: PaymentStepsProps) {
  return (
    <nav aria-label="Payment progress" aria-live="polite" className="flex flex-col gap-3 py-2">
      {STEPS.map((stepDef, idx) => {
        const status = getStepStatus(stepDef, currentStep, idx);
        return (
          <div key={stepDef.key} className="flex items-center gap-3">
            <StepIcon status={status} />
            <span
              className={`text-sm ${
                status === "active"
                  ? "font-medium text-foreground"
                  : status === "completed"
                    ? "text-muted-foreground line-through"
                    : "text-muted-foreground/60"
              }`}
            >
              {stepDef.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
