import { beforeEach, describe, expect, it } from "vitest";
import { clearProviderCache } from "@/lib/registry/loader";
import { getServiceByProviderAndType } from "@/lib/api/services";
import { aggregateServices, clearAggregatorCache } from "@/lib/registry/service-aggregator";
import { resolveServiceDetail } from "./service-detail-resolver";

describe("resolveServiceDetail", () => {
  beforeEach(() => {
    clearProviderCache();
    clearAggregatorCache();
  });

  it("returns canonical mock detail when provider and service type are in mock data", () => {
    const detail = resolveServiceDetail("prov-001", "text_echo");

    expect(detail).not.toBeNull();
    expect(detail?.provider_id).toBe("prov-001");
    expect(detail?.service_type).toBe("text_echo");
    expect(detail?.provider_name).toBe("Echo Labs");
  });

  it("falls back to registry detail when provider and service type exist only in registry", () => {
    const registryOnlyService = aggregateServices().find(
      (service) => getServiceByProviderAndType(service.provider_id, service.service_type) === null,
    );

    expect(registryOnlyService).toBeDefined();

    const detail = resolveServiceDetail(
      registryOnlyService!.provider_id,
      registryOnlyService!.service_type,
    );

    expect(detail).not.toBeNull();
    expect(detail?.provider_id).toBe(registryOnlyService!.provider_id);
    expect(detail?.service_type).toBe(registryOnlyService!.service_type);
    expect(detail?.provider_endpoint_url).toBe(registryOnlyService!.provider_endpoint_url);
    expect(detail?.input_schema.required).toContain("text");
  });

  it("returns null when provider and service type do not exist", () => {
    const detail = resolveServiceDetail("prov-missing", "text_echo");

    expect(detail).toBeNull();
  });
});
