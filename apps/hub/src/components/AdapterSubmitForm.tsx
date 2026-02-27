"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const FRAMEWORK_TYPE_OPTIONS = ["A2A", "LangGraph", "MCP", "Other"] as const;

const NPM_PACKAGE_REGEX = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const SubmitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  framework: z.string().min(1, "Framework is required"),
  npmPackage: z
    .string()
    .min(1, "npm package name is required")
    .regex(NPM_PACKAGE_REGEX, "invalid npm package name"),
  repositoryUrl: z.string().url("Must be a valid URL"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  frameworkType: z.enum(FRAMEWORK_TYPE_OPTIONS),
});

type SubmitStatus = "idle" | "submitting" | "success" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiErrorDetail {
  readonly path: readonly string[];
  readonly message: string;
}

function parseApiErrors(details: readonly ApiErrorDetail[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of details) {
    const field = detail.path[0];
    if (field && !errors[field]) {
      errors[field] = detail.message;
    }
  }
  return errors;
}

function parseZodErrors(error: z.ZodError): Record<string, string> {
  const flat = error.flatten().fieldErrors;
  const errors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) {
      errors[key] = messages[0];
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdapterSubmitForm() {
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [genericError, setGenericError] = useState<string | null>(null);
  const [frameworkType, setFrameworkType] =
    useState<(typeof FRAMEWORK_TYPE_OPTIONS)[number]>("Other");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGenericError(null);

    const formData = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = SubmitSchema.safeParse(formData);

    if (!parsed.success) {
      setFieldErrors(parseZodErrors(parsed.error));
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/adapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 201) {
        setStatus("success");
        return;
      }

      setStatus("error");
      let body: {
        error?: { code?: string; message?: string; details?: readonly ApiErrorDetail[] };
      } = {};
      try {
        body = await res.json();
      } catch {
        setGenericError("Submission failed. Please try again.");
        return;
      }
      if (body.error?.details && body.error.details.length > 0) {
        setFieldErrors(parseApiErrors(body.error.details));
      } else {
        setGenericError(body.error?.message ?? "Submission failed. Please try again.");
      }
    } catch {
      setGenericError("An unexpected error occurred. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Submission received</AlertTitle>
          <AlertDescription>Your Adapter has been submitted and is pending audit.</AlertDescription>
        </Alert>
        <Link
          href="/adapters"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          View all Adapters
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg" noValidate>
      <Link href="/adapters" className="text-sm text-muted-foreground hover:text-foreground">
        &larr; Back to Adapters
      </Link>

      <FormField label="Name" name="name" error={fieldErrors.name}>
        <Input type="text" id="name" name="name" required />
      </FormField>

      <FormField label="Framework" name="framework" error={fieldErrors.framework}>
        <Input type="text" id="framework" name="framework" required />
      </FormField>

      <FormField label="npm Package" name="npmPackage" error={fieldErrors.npmPackage}>
        <Input type="text" id="npmPackage" name="npmPackage" required />
      </FormField>

      <FormField label="Repository URL" name="repositoryUrl" error={fieldErrors.repositoryUrl}>
        <Input type="url" id="repositoryUrl" name="repositoryUrl" required />
      </FormField>

      <FormField label="Description" name="description" error={fieldErrors.description}>
        <Textarea id="description" name="description" rows={4} required />
      </FormField>

      <FormField label="Framework Type" name="frameworkType" error={fieldErrors.frameworkType}>
        <input type="hidden" name="frameworkType" value={frameworkType} />
        <Select
          value={frameworkType}
          onValueChange={(v) => setFrameworkType(v as (typeof FRAMEWORK_TYPE_OPTIONS)[number])}
        >
          <SelectTrigger id="frameworkType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FRAMEWORK_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {genericError && (
        <Alert variant="destructive">
          <AlertDescription>{genericError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Submit Adapter"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// FormField helper
// ---------------------------------------------------------------------------

interface FormFieldProps {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}

function FormField({ label, name, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
