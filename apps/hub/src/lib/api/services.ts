import type { ServiceDetail } from "@/lib/types/service";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";

const SERVICE_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

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
 * Returns all available service types for static generation.
 */
export function getAllServiceTypes(): readonly string[] {
  return MOCK_SERVICE_DETAILS.map((s) => s.service_type);
}

/**
 * Formats a USDC price string for display.
 */
export function formatPrice(priceUsdc: string): string {
  const parsed = parseFloat(priceUsdc);
  if (Number.isNaN(parsed)) return "0.00 USDC";
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
