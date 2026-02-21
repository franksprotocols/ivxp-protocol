import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import * as lockfile from "proper-lockfile";
import type { RegistryProviderWire } from "./types";
import { clearProviderCache, loadProviders } from "./loader";
import { clearAggregatorCache } from "./service-aggregator";

interface RegistryData {
  providers: RegistryProviderWire[];
}

/** Lock retry configuration for file-based registry operations */
const LOCK_RETRIES = 10;
const LOCK_MIN_TIMEOUT_MS = 100;
const LOCK_MAX_TIMEOUT_MS = 1000;
const LOCK_STALE_MS = 30_000;

const LOCK_OPTIONS = {
  retries: {
    retries: LOCK_RETRIES,
    minTimeout: LOCK_MIN_TIMEOUT_MS,
    maxTimeout: LOCK_MAX_TIMEOUT_MS,
  },
  stale: LOCK_STALE_MS,
} as const;

const RUNTIME_REGISTRY_FILE_PATH = join(tmpdir(), "ivxp-registry", "providers.json");

function getReadableRegistrySeedPath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, ".next", "server", "data", "registry", "providers.json"),
    join(cwd, "apps", "hub", ".next", "server", "data", "registry", "providers.json"),
    join(cwd, "src", "data", "registry", "providers.json"),
    join(cwd, "apps", "hub", "src", "data", "registry", "providers.json"),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

function ensureRuntimeRegistryFile(): string {
  if (existsSync(RUNTIME_REGISTRY_FILE_PATH)) {
    return RUNTIME_REGISTRY_FILE_PATH;
  }

  mkdirSync(dirname(RUNTIME_REGISTRY_FILE_PATH), { recursive: true });

  const seedPath = getReadableRegistrySeedPath();
  if (seedPath) {
    const seedRaw = readFileSync(seedPath, "utf-8");
    writeFileSync(RUNTIME_REGISTRY_FILE_PATH, seedRaw, "utf-8");
    return RUNTIME_REGISTRY_FILE_PATH;
  }

  const fallbackData: RegistryData = {
    providers: loadProviders(),
  };
  writeFileSync(RUNTIME_REGISTRY_FILE_PATH, JSON.stringify(fallbackData, null, 2), "utf-8");
  return RUNTIME_REGISTRY_FILE_PATH;
}

function getRegistryFilePath(): string {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    // Vercel server runtime bundle is read-only; use /tmp for mutable registry writes.
    return ensureRuntimeRegistryFile();
  }

  return join(process.cwd(), "src", "data", "registry", "providers.json");
}

/**
 * Classify and wrap errors from registry write operations
 * with more specific context for callers.
 */
function classifyWriteError(error: unknown, operation: string): Error {
  if (error instanceof SyntaxError) {
    return new Error(`Registry JSON parse error during ${operation}: ${error.message}`);
  }
  if (error instanceof Error) {
    if (error.message.includes("ENOENT")) {
      return new Error(`Registry file not found during ${operation}: ${error.message}`);
    }
    if (error.message.includes("EACCES") || error.message.includes("EPERM")) {
      return new Error(`Registry file permission denied during ${operation}: ${error.message}`);
    }
    if (error.message.includes("Lock file") || error.message.includes("lock")) {
      return new Error(`Registry lock acquisition failed during ${operation}: ${error.message}`);
    }
  }
  return error instanceof Error ? error : new Error(`Unknown error during ${operation}`);
}

/**
 * Check if a provider with the given address already exists.
 */
export function isProviderRegistered(
  providers: readonly RegistryProviderWire[],
  providerAddress: string,
): boolean {
  return providers.some((p) => p.provider_address.toLowerCase() === providerAddress.toLowerCase());
}

/**
 * Generate a new unique provider ID.
 */
export function generateProviderId(): string {
  return `prov-${randomUUID()}`;
}

/**
 * Add a new provider to the registry JSON file.
 * Uses file locking and atomic write to prevent race conditions.
 * Invalidates the in-memory cache after successful write.
 *
 * @throws Error if provider_address already exists or lock cannot be acquired
 */
export async function addProvider(
  newProvider: RegistryProviderWire,
): Promise<RegistryProviderWire> {
  const filePath = getRegistryFilePath();
  const tmpPath = `${filePath}.tmp`;
  let release: (() => Promise<void>) | null = null;

  try {
    release = await lockfile.lock(filePath, LOCK_OPTIONS);

    const raw = readFileSync(filePath, "utf-8");
    const data: RegistryData = JSON.parse(raw);

    if (isProviderRegistered(data.providers, newProvider.provider_address)) {
      throw new Error(`Provider with address ${newProvider.provider_address} already exists`);
    }

    const updatedData: RegistryData = {
      ...data,
      providers: [...data.providers, newProvider],
    };

    writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), "utf-8");
    renameSync(tmpPath, filePath);

    clearProviderCache();
    clearAggregatorCache();

    return newProvider;
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw classifyWriteError(error, "addProvider");
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Update a provider's name, description, and endpoint_url by address.
 * Uses file locking and atomic write to prevent race conditions.
 * Resets verification_status to "pending" when endpoint_url changes.
 * Invalidates the in-memory cache after successful write.
 *
 * @throws Error if provider not found, lock/filesystem/JSON errors
 */
export async function updateProvider(
  providerAddress: string,
  fields: { name: string; description: string; endpoint_url: string },
): Promise<RegistryProviderWire> {
  const filePath = getRegistryFilePath();
  const tmpPath = `${filePath}.tmp`;
  let release: (() => Promise<void>) | null = null;

  try {
    release = await lockfile.lock(filePath, LOCK_OPTIONS);

    const raw = readFileSync(filePath, "utf-8");
    const data: RegistryData = JSON.parse(raw);

    const index = data.providers.findIndex(
      (p) => p.provider_address.toLowerCase() === providerAddress.toLowerCase(),
    );

    if (index === -1) {
      throw new Error(`Provider with address ${providerAddress} not found`);
    }

    const existing = data.providers[index];
    const endpointChanged = existing.endpoint_url !== fields.endpoint_url;

    const updatedProvider: RegistryProviderWire = {
      ...existing,
      name: fields.name,
      description: fields.description,
      endpoint_url: fields.endpoint_url,
      updated_at: new Date().toISOString(),
      ...(endpointChanged
        ? {
            verification_status: "pending" as const,
            last_verified_at: null,
            consecutive_failures: 0,
          }
        : {}),
    };

    const updatedProviders = data.providers.map((p, i) => (i === index ? updatedProvider : p));
    const updatedData: RegistryData = { ...data, providers: updatedProviders };

    writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), "utf-8");
    renameSync(tmpPath, filePath);

    clearProviderCache();
    clearAggregatorCache();

    return updatedProvider;
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw classifyWriteError(error, "updateProvider");
  } finally {
    if (release) {
      await release();
    }
  }
}

/**
 * Update verification fields for one or more providers.
 * Uses file locking and atomic write to prevent race conditions.
 * Invalidates the in-memory cache after successful write.
 */
export async function updateProviderVerifications(
  updates: Map<string, Partial<RegistryProviderWire>>,
): Promise<void> {
  const filePath = getRegistryFilePath();
  const tmpPath = `${filePath}.tmp`;
  let release: (() => Promise<void>) | null = null;

  try {
    release = await lockfile.lock(filePath, LOCK_OPTIONS);

    const raw = readFileSync(filePath, "utf-8");
    const data: RegistryData = JSON.parse(raw);

    const updatedProviders = data.providers.map((provider) => {
      const update = updates.get(provider.provider_id);
      if (update) {
        return { ...provider, ...update };
      }
      return provider;
    });

    const updatedData: RegistryData = { ...data, providers: updatedProviders };

    writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), "utf-8");
    renameSync(tmpPath, filePath);

    clearProviderCache();
    clearAggregatorCache();
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw classifyWriteError(error, "updateProviderVerifications");
  } finally {
    if (release) {
      await release();
    }
  }
}
