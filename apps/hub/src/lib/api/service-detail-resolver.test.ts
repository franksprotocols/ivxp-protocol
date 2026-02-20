import { beforeEach, describe, expect, it } from "vitest";
import { clearAggregatorCache } from "@/lib/registry/service-aggregator";
import { resolveServiceDetail } from "./service-detail-resolver";

describe("resolveServiceDetail", () => {
  beforeEach(() => {
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
    const detail = resolveServiceDetail("prov-eee54359-33f8-4373-992e-d223bf44b10b", "text_echo");

    expect(detail).not.toBeNull();
    expect(detail?.provider_id).toBe("prov-eee54359-33f8-4373-992e-d223bf44b10b");
    expect(detail?.service_type).toBe("text_echo");
    expect(detail?.provider_endpoint_url).toBe("http://localhost:3001");
    expect(detail?.input_schema.required).toContain("text");
  });

  it("returns null when provider and service type do not exist", () => {
    const detail = resolveServiceDetail("prov-missing", "text_echo");

    expect(detail).toBeNull();
  });
});
