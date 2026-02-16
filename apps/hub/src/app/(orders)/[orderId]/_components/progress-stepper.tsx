import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/stores/order-store";

interface ProgressStepperProps {
  readonly status: OrderStatus;
}

type StepState = "completed" | "current" | "error" | "upcoming";

interface StepDefinition {
  readonly id: string;
  readonly label: string;
}

const STEPS: readonly StepDefinition[] = [
  { id: "quoted", label: "Quoted" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "Processing" },
  { id: "delivered", label: "Delivered" },
] as const;

/**
 * Maps an OrderStatus to a numeric index in the stepper.
 * "paying" maps to the same step as "quoted" since payment
 * hasn't been confirmed yet.
 */
function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case "quoted":
    case "paying":
      return 0;
    case "paid":
      return 1;
    case "processing":
    case "failed":
    case "delivery_failed":
      return 2;
    case "delivered":
      return 3;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function isFailedStatus(status: OrderStatus): boolean {
  return status === "failed" || status === "delivery_failed";
}

function getStepState(stepIndex: number, currentIndex: number, status: OrderStatus): StepState {
  if (isFailedStatus(status) && stepIndex === currentIndex) {
    return "error";
  }
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

function StepIcon({ state }: { readonly state: StepState }) {
  if (state === "completed") {
    return <Check className="h-4 w-4 text-white" aria-hidden="true" />;
  }
  if (state === "error") {
    return <AlertCircle className="h-4 w-4 text-white" aria-hidden="true" />;
  }
  return <Circle className="h-3 w-3" aria-hidden="true" />;
}

/**
 * Visual progress stepper showing order state progression:
 * Quoted -> Paid -> Processing -> Delivered
 *
 * Failed states show an error icon on the step where failure occurred.
 */
export function ProgressStepper({ status }: ProgressStepperProps) {
  const currentIndex = getStepIndex(status);

  return (
    <nav aria-label="Order progress" className="w-full">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const state = getStepState(index, currentIndex, status);
          const isLast = index === STEPS.length - 1;

          return (
            <li
              key={step.id}
              data-testid={`step-${step.id}`}
              data-state={state}
              className={cn("flex items-center", !isLast && "flex-1")}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    state === "completed" && "border-green-600 bg-green-600",
                    state === "current" && "border-blue-600 bg-blue-600 text-white",
                    state === "error" && "border-red-600 bg-red-600",
                    state === "upcoming" && "border-muted-foreground/30 text-muted-foreground/50",
                  )}
                >
                  <StepIcon state={state} />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    state === "completed" && "text-green-600",
                    state === "current" && "text-blue-600",
                    state === "error" && "text-red-600",
                    state === "upcoming" && "text-muted-foreground/50",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    index < currentIndex ? "bg-green-600" : "bg-muted-foreground/20",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
