import { z } from "zod";

// ---------------------------------------------------------------------------
// WARNING: This is an in-memory store intended for development and single-
// process deployments only. Data is lost on process restart and is NOT shared
// across multiple server instances (e.g. serverless functions, clustered
// Node.js). Replace with a persistent data store before production use.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdapterStatus = "pending_audit" | "published" | "rejected";
export type FrameworkType = "A2A" | "LangGraph" | "MCP" | "Other";

export interface AdapterEntry {
  readonly id: string;
  readonly name: string;
  readonly framework: string;
  readonly version: string;
  readonly npmPackage: string;
  readonly repositoryUrl: string;
  readonly description: string;
  readonly frameworkType: FrameworkType;
  readonly status: AdapterStatus;
  readonly createdAt: string; // ISO 8601
  readonly auditResult?: boolean;
  readonly rejectionReason?: string;
}

export interface AdapterStore {
  readonly adapters: readonly AdapterEntry[];
}

export interface PaginatedAdapters {
  readonly adapters: readonly AdapterEntry[];
  /** Count of adapters matching the current filter criteria, not the overall store total. */
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const FRAMEWORK_TYPE_VALUES = ["A2A", "LangGraph", "MCP", "Other"] as const;

export const FRAMEWORK_TYPES: readonly FrameworkType[] = FRAMEWORK_TYPE_VALUES;

export const createAdapterSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  framework: z.string().min(1, "framework is required").max(200),
  version: z
    .string()
    .min(1, "version is required")
    .max(50)
    .regex(/^\d+\.\d+\.\d+$/, "version must follow semver (e.g. 1.0.0)"),
  npmPackage: z
    .string()
    .min(1, "npmPackage is required")
    .max(214)
    .regex(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/, "invalid npm package name"),
  repositoryUrl: z
    .string()
    .url("repositoryUrl must be a valid URL")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "repositoryUrl must use http or https scheme" },
    ),
  description: z.string().min(1, "description is required").max(2000),
  frameworkType: z.enum(FRAMEWORK_TYPE_VALUES),
});

export type CreateAdapterInput = z.infer<typeof createAdapterSchema>;

export const auditBodySchema = z.object({
  passed: z.boolean(),
  reason: z.string().min(1, "reason must not be empty").max(2000).optional(),
});

export type AuditBodyInput = z.infer<typeof auditBodySchema>;

// ---------------------------------------------------------------------------
// Store helpers (immutable)
// ---------------------------------------------------------------------------

const INITIAL_STORE: AdapterStore = { adapters: [] };

let _store: AdapterStore = INITIAL_STORE;

/** Generate a simple UUID v4 */
function generateId(): string {
  return crypto.randomUUID();
}

export function getStore(): AdapterStore {
  return _store;
}

/** Reset store to empty state (for testing) */
export function resetStore(): void {
  _store = { adapters: [] };
}

export function createAdapter(input: CreateAdapterInput): AdapterEntry {
  const entry: AdapterEntry = {
    id: generateId(),
    ...input,
    status: "pending_audit",
    createdAt: new Date().toISOString(),
  };
  _store = { adapters: [..._store.adapters, entry] };
  return entry;
}

export function listPublishedAdapters(opts: {
  page: number;
  limit: number;
  frameworkType?: FrameworkType;
}): PaginatedAdapters {
  const published = _store.adapters.filter(
    (a) =>
      a.status === "published" &&
      (opts.frameworkType === undefined || a.frameworkType === opts.frameworkType),
  );
  const start = (opts.page - 1) * opts.limit;
  const sliced = published.slice(start, start + opts.limit);
  return { adapters: sliced, total: published.length };
}

export function getAdapter(id: string): AdapterEntry | undefined {
  return _store.adapters.find((a) => a.id === id);
}

export function updateAdapterStatus(
  id: string,
  status: AdapterStatus,
  extra?: { auditResult?: boolean; rejectionReason?: string },
): AdapterEntry | undefined {
  const existing = _store.adapters.find((a) => a.id === id);
  if (!existing) return undefined;

  const updated: AdapterEntry = {
    ...existing,
    status,
    ...(extra?.auditResult !== undefined ? { auditResult: extra.auditResult } : {}),
    ...(extra?.rejectionReason !== undefined ? { rejectionReason: extra.rejectionReason } : {}),
  };

  _store = {
    adapters: _store.adapters.map((a) => (a.id === id ? updated : a)),
  };

  return updated;
}

export function deleteAdapter(id: string): boolean {
  const before = _store.adapters.length;
  _store = {
    adapters: _store.adapters.filter((a) => a.id !== id),
  };
  return _store.adapters.length < before;
}
