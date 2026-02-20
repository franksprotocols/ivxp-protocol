import type { ServiceDetail } from "@/lib/types/service";
import { getServiceByProviderAndType } from "@/lib/api/services";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";
import { aggregateServices } from "@/lib/registry/service-aggregator";

const FALLBACK_INPUT_SCHEMA: ServiceDetail["input_schema"] = {
  type: "object",
  properties: {},
  required: [],
};

const FALLBACK_OUTPUT_SCHEMA: ServiceDetail["output_schema"] = {
  type: "object",
  format: "application/json",
};

function formatEstimatedTime(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (seconds < 60) return "< 1 minute";
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
}

export function resolveServiceDetail(providerId: string, serviceType: string): ServiceDetail | null {
  const canonical = getServiceByProviderAndType(providerId, serviceType);
  if (canonical) {
    return canonical;
  }

  const registryService = aggregateServices().find(
    (service) => service.provider_id === providerId && service.service_type === serviceType,
  );
  if (!registryService) {
    return null;
  }

  const template = MOCK_SERVICE_DETAILS.find((service) => service.service_type === serviceType);

  return {
    service_type: registryService.service_type,
    description: registryService.description,
    long_description: template?.long_description ?? registryService.description,
    price_usdc: registryService.price_usdc,
    provider_address: registryService.provider_address as `0x${string}`,
    provider_id: registryService.provider_id,
    provider_endpoint_url: registryService.provider_endpoint_url,
    provider_name: registryService.provider_name,
    provider_url: registryService.provider_endpoint_url,
    provider_reputation: template?.provider_reputation,
    category: template?.category,
    tags: template?.tags ?? [],
    estimated_time: template?.estimated_time ?? formatEstimatedTime(registryService.estimated_time_seconds),
    input_schema: template?.input_schema ?? FALLBACK_INPUT_SCHEMA,
    output_schema: template?.output_schema ?? FALLBACK_OUTPUT_SCHEMA,
    examples: template?.examples,
  };
}
