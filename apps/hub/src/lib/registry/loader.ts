import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RegistryProviderWire } from "./types";

export interface RegistryData {
  providers: RegistryProviderWire[];
}

let cachedProviders: RegistryProviderWire[] | null = null;

/**
 * Resolve the path to the providers.json file.
 * Works in both development (src/ exists) and production (built output).
 */
function getProvidersFilePath(): string {
  const cwd = process.cwd();

  // In production, Next.js builds to .next/server
  // The data file should be copied to the build output
  if (process.env.NODE_ENV === "production") {
    return join(cwd, ".next", "server", "data", "registry", "providers.json");
  }

  // In development, read from src/
  return join(cwd, "src", "data", "registry", "providers.json");
}

/**
 * Load providers from the static JSON registry.
 * Caches the result in memory after first read.
 *
 * @returns Array of provider records from the registry
 * @throws Error if the file cannot be read or parsed
 */
export function loadProviders(): RegistryProviderWire[] {
  if (cachedProviders !== null) {
    return cachedProviders;
  }

  const filePath = getProvidersFilePath();
  const raw = readFileSync(filePath, "utf-8");
  const data: RegistryData = JSON.parse(raw);

  if (!data.providers || !Array.isArray(data.providers)) {
    throw new Error("Invalid registry data: missing or invalid 'providers' array");
  }

  cachedProviders = data.providers;
  return cachedProviders;
}

/**
 * Clear the provider cache. Useful for testing.
 */
export function clearProviderCache(): void {
  cachedProviders = null;
}
