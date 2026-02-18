import type { ServiceDetail } from "@/lib/types/service";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";

const SERVICE_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const PROVIDER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Fetches a service by its service_type identifier.
 * Returns null if the service is not found or the type is invalid.
 */
export function getServiceByType(serviceType: string): ServiceDetail | null {
  if (!serviceType || !SERVICE_TYPE_PATTERN.test(serviceType)) {
    return null;
  }

  const service = MOCK_SERVICE_DETAILS.find((s) => s.service_type === serviceType);

  return service ?? null;
}

/**
 * Fetches a service using the canonical provider_id + service_type key.
 */
export function getServiceByProviderAndType(
  providerId: string,
  serviceType: string,
): ServiceDetail | null {
  if (!providerId || !PROVIDER_ID_PATTERN.test(providerId)) {
    return null;
  }
  if (!serviceType || !SERVICE_TYPE_PATTERN.test(serviceType)) {
    return null;
  }

  const service = MOCK_SERVICE_DETAILS.find(
    (s) => s.service_type === serviceType && s.provider_id === providerId,
  );
  return service ?? null;
}

/**
 * Finds all services matching a service_type across providers.
 */
export function findServicesByType(serviceType: string): readonly ServiceDetail[] {
  if (!serviceType || !SERVICE_TYPE_PATTERN.test(serviceType)) {
    return [];
  }
  return MOCK_SERVICE_DETAILS.filter((s) => s.service_type === serviceType);
}

export type LegacyRouteResolution =
  | { readonly kind: "none" }
  | { readonly kind: "multi"; readonly serviceType: string }
  | { readonly kind: "unique"; readonly providerId: string; readonly serviceType: string };

/**
 * Resolves legacy /marketplace/{serviceType} route behavior.
 */
export function resolveLegacyServiceRoute(serviceType: string): LegacyRouteResolution {
  if (!serviceType || !SERVICE_TYPE_PATTERN.test(serviceType)) {
    return { kind: "none" };
  }

  const providerIds = [
    ...new Set(
      MOCK_SERVICE_DETAILS.filter(
        (service) => service.service_type === serviceType && Boolean(service.provider_id),
      )
        .map((service) => service.provider_id)
        .filter((providerId): providerId is string => Boolean(providerId)),
    ),
  ];

  if (providerIds.length === 0) {
    return { kind: "none" };
  }
  if (providerIds.length === 1) {
    return { kind: "unique", providerId: providerIds[0], serviceType };
  }
  return { kind: "multi", serviceType };
}

/**
 * Returns all available service types for static generation.
 */
export function getAllServiceTypes(): readonly string[] {
  return [...new Set(MOCK_SERVICE_DETAILS.map((s) => s.service_type))];
}

/**
 * Returns all canonical (providerId, serviceType) params for static generation.
 */
export function getCanonicalServiceParams(): readonly { providerId: string; serviceType: string }[] {
  return MOCK_SERVICE_DETAILS.flatMap((service) =>
    service.provider_id ? [{ providerId: service.provider_id, serviceType: service.service_type }] : [],
  );
}

/**
 * Formats a USDC price string for display.
 */
export function formatPrice(priceUsdc: string): string {
  const parsed = parseFloat(priceUsdc);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
    return "0.00 USDC";
  }
  return `${parsed.toFixed(2)} USDC`;
}

/**
 * Formats a service_type string into a human-readable name.
 */
export function formatServiceName(serviceType: string): string {
  if (!serviceType || serviceType.trim() === "") return "";
  return serviceType
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
