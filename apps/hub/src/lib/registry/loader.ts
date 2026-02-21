import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bundledRegistryData from "@/data/registry/providers.json";
import type { RegistryProviderWire } from "./types";

export interface RegistryData {
  providers: RegistryProviderWire[];
}

let cachedProviders: RegistryProviderWire[] | null = null;

/**
 * Candidate locations for providers.json.
 * Supports both:
 * - app-root deployments (cwd = apps/hub)
 * - monorepo-root deployments (cwd = repo root)
 */
function getProvidersFileCandidates(): string[] {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, ".next", "server", "data", "registry", "providers.json"),
    join(cwd, "apps", "hub", ".next", "server", "data", "registry", "providers.json"),
    join(cwd, "src", "data", "registry", "providers.json"),
    join(cwd, "apps", "hub", "src", "data", "registry", "providers.json"),
  ];

  const uniqueCandidates: string[] = [];
  for (const path of candidates) {
    if (!uniqueCandidates.includes(path)) {
      uniqueCandidates.push(path);
    }
  }

  return uniqueCandidates;
}

function isRegistryData(value: unknown): value is RegistryData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const typed = value as { providers?: unknown };
  return Array.isArray(typed.providers);
}

function parseRegistryData(data: unknown, source: string): RegistryData {
  if (!isRegistryData(data)) {
    throw new Error(`Invalid registry data from ${source}: missing or invalid 'providers' array`);
  }

  return {
    providers: data.providers,
  };
}

function loadRegistryDataFromDisk(): RegistryData | null {
  for (const filePath of getProvidersFileCandidates()) {
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return parseRegistryData(parsed, filePath);
  }

  return null;
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

  const diskData = loadRegistryDataFromDisk();
  const data = diskData ?? parseRegistryData(bundledRegistryData, "bundled-registry");

  cachedProviders = data.providers;
  return cachedProviders;
}

/**
 * Clear the provider cache. Useful for testing.
 */
export function clearProviderCache(): void {
  cachedProviders = null;
}
