import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { mockProviders } from "@/lib/registry/test-fixtures";

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => mockProviders.slice(0, 2)),
}));

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("GET /api/registry/providers", () => {
  it("returns paginated provider list with defaults", async () => {
    const response = await GET(createRequest("/api/registry/providers"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(20);
  });

  it("filters by service_type", async () => {
    const response = await GET(createRequest("/api/registry/providers?service_type=text_echo"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("returns empty for non-matching service_type", async () => {
    const response = await GET(createRequest("/api/registry/providers?service_type=nonexistent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("filters by search query", async () => {
    const response = await GET(createRequest("/api/registry/providers?q=alpha"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("returns 400 for invalid page parameter", async () => {
    const response = await GET(createRequest("/api/registry/providers?page=-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
    expect(body.error.details).toBeDefined();
  });

  it("returns 400 for page_size exceeding max", async () => {
    const response = await GET(createRequest("/api/registry/providers?page_size=999"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
  });

  it("supports pagination parameters", async () => {
    const response = await GET(createRequest("/api/registry/providers?page=1&page_size=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(5);
  });

  it("returns snake_case fields in response", async () => {
    const response = await GET(createRequest("/api/registry/providers"));
    const body = await response.json();

    expect(body).toHaveProperty("providers");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("page_size");
    expect(body.providers[0]).toHaveProperty("provider_id");
    expect(body.providers[0]).toHaveProperty("provider_address");
    expect(body.providers[0]).toHaveProperty("endpoint_url");
    expect(body.providers[0]).toHaveProperty("registered_at");
    expect(body.providers[0]).toHaveProperty("updated_at");
  });

  it("returns empty results with total 0 for search with no matches", async () => {
    const response = await GET(createRequest("/api/registry/providers?q=zzzznonexistent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });
});
