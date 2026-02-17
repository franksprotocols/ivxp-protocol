"use client";

import { Info } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PLAYGROUND_STEPS } from "./playground-constants";

export function QuickStartGuide() {
  return (
    <Alert data-testid="quick-start-guide">
      <Info className="h-4 w-4" />
      <AlertTitle>Quick Start Guide</AlertTitle>
      <AlertDescription>
        <ol className="list-decimal list-inside space-y-1 mt-2">
          {PLAYGROUND_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </AlertDescription>
    </Alert>
  );
}
