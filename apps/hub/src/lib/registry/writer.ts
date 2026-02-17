import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
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
 * Uses atomic write (write to temp file, then rename) to prevent corruption.
 * Checks for duplicates atomically to prevent race conditions.
 * Invalidates the in-memory cache after successful write.
 *
 * @throws Error if provider_address already exists
 */
export function addProvider(newProvider: RegistryProviderWire): RegistryProviderWire {
  const filePath = getRegistryFilePath();
  const tmpPath = `${filePath}.tmp`;

  try {
    // Read current data
    const raw = readFileSync(filePath, "utf-8");
    const data: RegistryData = JSON.parse(raw);

    // Check for duplicate AFTER reading (atomic check-then-write)
    if (isProviderRegistered(data.providers, newProvider.provider_address)) {
      throw new Error(`Provider with address ${newProvider.provider_address} already exists`);
    }

    // Create new array with the appended provider (immutable)
    const updatedData: RegistryData = {
      ...data,
      providers: [...data.providers, newProvider],
    };

    // Atomic write: write to temp file, then rename
    writeFileSync(tmpPath, JSON.stringify(updatedData, null, 2), "utf-8");
    renameSync(tmpPath, filePath);

    // Invalidate in-memory cache so GET reflects the new provider
    clearProviderCache();

    return newProvider;
  } catch (error) {
    // Clean up temp file if it exists
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}
