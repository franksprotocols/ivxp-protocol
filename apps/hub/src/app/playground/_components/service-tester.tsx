"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServiceDetail, SchemaProperty } from "@/lib/types/service";
import type { ProtocolEvent, StateTransition } from "@/hooks/use-protocol-events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlowPhase = "idle" | "quoting" | "paying" | "delivering" | "complete" | "error";

export interface ExecutionResult {
  readonly orderId: string;
  readonly txHash: string;
  readonly signature: string;
  readonly contentHash: string;
  readonly deliverable: unknown;
  readonly phase: FlowPhase;
}

interface ServiceTesterProps {
  readonly services: readonly ServiceDetail[];
  readonly providerUrl: string;
  readonly onEvent?: (event: ProtocolEvent) => void;
  readonly onTransition?: (transition: StateTransition) => void;
  readonly onResult?: (result: ExecutionResult) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Simulation delay durations in milliseconds. */
const SIMULATION_DELAYS = {
  quote: 800,
  payment: 1200,
  delivery: 1000,
} as const;

/** Hex character lengths for generated identifiers. */
const HEX_LENGTHS = {
  txHash: 64,
  signature: 130,
  contentHash: 64,
} as const;

function getServiceOptionValue(service: ServiceDetail): string {
  const providerKey = service.provider_id ?? service.provider_address;
  return `${providerKey}::${service.service_type}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultValues(service: ServiceDetail): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const [key, prop] of Object.entries(service.input_schema.properties)) {
    defaults[key] = prop.example !== undefined && prop.example !== null ? String(prop.example) : "";
  }
  return defaults;
}

function nextId(type: string): string {
  return `${type}-${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Validates input values against the service's input_schema.
 * Returns an array of error messages for missing required fields.
 */
export function validateInputs(
  service: ServiceDetail,
  values: Record<string, string>,
): readonly string[] {
  const requiredFields = service.input_schema.required ?? [];
  const errors: string[] = [];
  for (const field of requiredFields) {
    const value = values[field];
    if (value === undefined || value.trim() === "") {
      const prop = service.input_schema.properties[field];
      const label = prop?.description ?? field;
      errors.push(`${label} is required`);
    }
  }
  return errors;
}

function emitEvent(type: string, payload: unknown, onEvent?: (e: ProtocolEvent) => void): void {
  onEvent?.({
    id: nextId(type),
    type,
    payload,
    receivedAt: new Date(),
  });
}

function emitTransition(
  from: string | null,
  to: string,
  onTransition?: (t: StateTransition) => void,
): void {
  onTransition?.({ from, to, timestamp: new Date() });
}

// ---------------------------------------------------------------------------
// Simulated purchase flow
// ---------------------------------------------------------------------------

async function simulatePurchaseFlow(
  service: ServiceDetail,
  input: Record<string, string>,
  providerUrl: string,
  onEvent?: (e: ProtocolEvent) => void,
  onTransition?: (t: StateTransition) => void,
): Promise<ExecutionResult> {
  const orderId = `order_${Date.now()}`;
  const txHash = `0x${Array.from({ length: HEX_LENGTHS.txHash }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  const signature = `0x${Array.from({ length: HEX_LENGTHS.signature }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  const contentHash = `0x${Array.from({ length: HEX_LENGTHS.contentHash }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

  // Phase 1: Quote
  emitTransition(null, "quoting", onTransition);
  emitEvent(
    "order.quoted",
    {
      orderId,
      serviceType: service.service_type,
      priceUsdc: service.price_usdc,
      providerUrl,
    },
    onEvent,
  );
  await new Promise((r) => setTimeout(r, SIMULATION_DELAYS.quote));

  // Phase 2: Payment
  emitTransition("quoting", "paying", onTransition);
  emitEvent("payment.sent", { orderId, txHash, amount: service.price_usdc }, onEvent);
  await new Promise((r) => setTimeout(r, SIMULATION_DELAYS.payment));
  emitEvent("payment.confirmed", { orderId, txHash, blockNumber: 12345678 }, onEvent);

  // Phase 3: Delivery
  emitTransition("paying", "delivering", onTransition);
  emitEvent(
    "order.status_changed",
    {
      orderId,
      previousStatus: "paid",
      newStatus: "delivering",
    },
    onEvent,
  );
  await new Promise((r) => setTimeout(r, SIMULATION_DELAYS.delivery));

  const deliverable = {
    result: `Demo result for ${service.service_type}`,
    input,
    processedAt: new Date().toISOString(),
  };

  emitEvent(
    "order.delivered",
    {
      orderId,
      contentHash,
      deliverable,
    },
    onEvent,
  );
  emitTransition("delivering", "complete", onTransition);

  return {
    orderId,
    txHash,
    signature,
    contentHash,
    deliverable,
    phase: "complete",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ServiceTester({
  services,
  providerUrl,
  onEvent,
  onTransition,
  onResult,
}: ServiceTesterProps) {
  const [selectedServiceKey, setSelectedServiceKey] = useState<string>("");
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<FlowPhase>("idle");
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<readonly string[]>([]);

  const selectedService = services.find((s) => getServiceOptionValue(s) === selectedServiceKey);

  const handleServiceSelect = useCallback(
    (serviceKey: string) => {
      setSelectedServiceKey(serviceKey);
      setResult(null);
      setError(null);
      setValidationErrors([]);
      setPhase("idle");
      const svc = services.find((s) => getServiceOptionValue(s) === serviceKey);
      if (svc) {
        setInputValues(buildDefaultValues(svc));
      }
    },
    [services],
  );

  const handleInputChange = useCallback((key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExecute = useCallback(async () => {
    if (!selectedService) return;

    // Validate required fields before executing
    const errors = validateInputs(selectedService, inputValues);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setPhase("quoting");
    setError(null);
    setResult(null);

    try {
      const execResult = await simulatePurchaseFlow(
        selectedService,
        inputValues,
        providerUrl,
        onEvent,
        onTransition,
      );
      setResult(execResult);
      setPhase("complete");
      onResult?.(execResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      setError(message);
      setPhase("error");
    }
  }, [selectedService, inputValues, providerUrl, onEvent, onTransition, onResult]);

  const isExecuting = phase !== "idle" && phase !== "complete" && phase !== "error";

  return (
    <Card data-testid="service-tester">
      <CardHeader>
        <CardTitle>Test a Service (Simulated)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          data-testid="simulation-note"
        >
          This tester emits simulated protocol artifacts for learning. For real provider execution,
          use the marketplace flow.
        </div>
        {/* Service selector */}
        <div className="space-y-2">
          <Label htmlFor="service-select">Select Service</Label>
          <Select value={selectedServiceKey} onValueChange={handleServiceSelect}>
            <SelectTrigger id="service-select" data-testid="service-select">
              <SelectValue placeholder="Choose a service..." />
            </SelectTrigger>
            <SelectContent>
              {services.map((s) => (
                <SelectItem key={getServiceOptionValue(s)} value={getServiceOptionValue(s)}>
                  {s.service_type} ({s.price_usdc} USDC)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic input form */}
        {selectedService && (
          <DynamicInputFields
            service={selectedService}
            values={inputValues}
            onChange={handleInputChange}
          />
        )}

        {/* Execute button */}
        <Button
          onClick={handleExecute}
          disabled={!selectedService || isExecuting}
          data-testid="execute-button"
          className="w-full"
        >
          {isExecuting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {phase === "quoting" && "Getting quote..."}
              {phase === "paying" && "Processing payment..."}
              {phase === "delivering" && "Awaiting delivery..."}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Execute Service
            </>
          )}
        </Button>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3"
            data-testid="validation-errors"
            role="alert"
          >
            <p className="text-sm font-medium text-destructive">Please fix the following:</p>
            <ul className="mt-1 list-disc list-inside text-sm text-destructive">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error display */}
        {error && (
          <p className="text-sm text-destructive" data-testid="execution-error">
            {error}
          </p>
        )}

        {/* Result display */}
        {result && <ResultDisplay result={result} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DynamicInputFields({
  service,
  values,
  onChange,
}: {
  readonly service: ServiceDetail;
  readonly values: Record<string, string>;
  readonly onChange: (key: string, value: string) => void;
}) {
  const properties = service.input_schema.properties;
  const requiredFields = service.input_schema.required ?? [];

  return (
    <div className="space-y-3" data-testid="dynamic-input-fields">
      {Object.entries(properties).map(([key, prop]: [string, SchemaProperty]) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={`input-${key}`}>
            {prop.description}
            {!requiredFields.includes(key) && (
              <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
            )}
          </Label>
          <Input
            id={`input-${key}`}
            type={prop.type === "number" ? "number" : "text"}
            placeholder={prop.example !== undefined ? String(prop.example) : ""}
            value={values[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            data-testid={`input-${key}`}
          />
        </div>
      ))}
    </div>
  );
}

function ResultDisplay({ result }: { readonly result: ExecutionResult }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-4 space-y-2" data-testid="execution-result">
      <h4 className="font-medium text-sm">Simulated Execution Complete</h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-medium text-muted-foreground">Order ID</dt>
        <dd className="font-mono break-all">{result.orderId}</dd>
        <dt className="font-medium text-muted-foreground">TX Hash</dt>
        <dd className="font-mono break-all">{result.txHash}</dd>
        <dt className="font-medium text-muted-foreground">Content Hash</dt>
        <dd className="font-mono break-all">{result.contentHash}</dd>
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">View deliverable</summary>
        <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(result.deliverable, null, 2)}
        </pre>
      </details>
      <Link
        href="/marketplace"
        className="inline-block text-xs text-primary underline underline-offset-2"
        data-testid="real-flow-cta"
      >
        Run real marketplace flow
      </Link>
    </div>
  );
}
