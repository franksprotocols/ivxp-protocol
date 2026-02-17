import type { RegistryProviderWire, SearchServiceResultWire } from "./types";
import { loadProviders } from "./loader";

interface AggregatorCache {
  readonly services: readonly SearchServiceResultWire[];
  readonly timestamp: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Cache holder using a functional approach with immutable data.
 * The cache reference itself is mutable, but the cached data is immutable.
 */
class CacheHolder {
  private cache: AggregatorCache | null = null;

  get(): AggregatorCache | null {
    return this.cache;
  }

  set(services: readonly SearchServiceResultWire[], timestamp: number): void {
    this.cache = { services, timestamp };
  }

  clear(): void {
    this.cache = null;
  }
}

const cacheHolder = new CacheHolder();

/**
 * Aggregate services from all verified, active providers.
 * Flattens the provider->services hierarchy into a flat list
 * with provider metadata attached to each service.
 * Results are cached for CACHE_TTL_MS.
 */
export function aggregateServices(): SearchServiceResultWire[] {
  const now = Date.now();
  const cached = cacheHolder.get();

  if (cached !== null && now - cached.timestamp < CACHE_TTL_MS) {
    return [...cached.services];
  }

  const providers = loadProviders();
  const services = flattenProviderServices(providers);

  cacheHolder.set(services, now);
  return services;
}

/**
 * Flatten services from verified, active providers into a flat list.
 * Each service entry includes its parent provider metadata.
 */
export function flattenProviderServices(
  providers: RegistryProviderWire[],
): SearchServiceResultWire[] {
  const verifiedActive = providers.filter(
    (p) => p.status === "active" && p.verification_status === "verified",
  );

  return verifiedActive.flatMap((provider) =>
    provider.services.map((service) => ({
      service_type: service.service_type,
      name: service.name,
      description: service.description,
      price_usdc: service.price_usdc,
      estimated_time_seconds: service.estimated_time_seconds,
      provider_id: provider.provider_id,
      provider_name: provider.name,
      provider_address: provider.provider_address,
      provider_endpoint_url: provider.endpoint_url,
    })),
  );
}

/**
 * Clear the aggregator cache. Useful for testing.
 */
export function clearAggregatorCache(): void {
  cacheHolder.clear();
}
