import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as lockfile from "proper-lockfile";
import type { RegistryProviderWire } from "./types";
import { clearProviderCache } from "./loader";

interface RegistryData {
  providers: RegistryProviderWire[];
}

function getRegistryFilePath(): string {
  return join(process.cwd(), "src", "data", "registry", "providers.json");
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
    // Acquire exclusive lock with 10s timeout
    release = await lockfile.lock(filePath, {
      retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
      stale: 30000,
    });

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

    return newProvider;
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
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
    // Acquire exclusive lock with 10s timeout
    release = await lockfile.lock(filePath, {
      retries: { retries: 10, minTimeout: 100, maxTimeout: 1000 },
      stale: 30000,
    });

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
  } catch (error) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  } finally {
    if (release) {
      await release();
    }
  }
}
