import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock the aggregator to return controlled test data
vi.mock("@/lib/registry/service-aggregator", () => ({
  aggregateServices: vi.fn(() => [
    {
      service_type: "text_echo",
      name: "Text Echo",
      description: "Echoes back the input text",
      price_usdc: "0.10",
      estimated_time_seconds: 5,
      provider_id: "prov-001",
      provider_name: "Demo Provider",
      provider_address: "0xAAA",
      provider_endpoint_url: "https://demo.example.com",
    },
    {
      service_type: "image_gen",
      name: "Image Generation",
      description: "Generates images from text prompts",
      price_usdc: "1.50",
      estimated_time_seconds: 10,
      provider_id: "prov-001",
      provider_name: "Demo Provider",
      provider_address: "0xAAA",
      provider_endpoint_url: "https://demo.example.com",
    },
    {
      service_type: "research",
      name: "Deep Research",
      description: "Comprehensive research on any topic",
      price_usdc: "50.00",
      estimated_time_seconds: 28800,
      provider_id: "prov-002",
      provider_name: "Research Agent",
      provider_address: "0xBBB",
      provider_endpoint_url: "https://research.example.com",
    },
  ]),
}));

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/registry/services/search", () => {
  it("returns all services with defaults", async () => {
    const response = await GET(createRequest("/api/registry/services/search"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(20);
  });

  it("filters by text search query", async () => {
    const response = await GET(createRequest("/api/registry/services/search?q=image"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].service_type).toBe("image_gen");
    expect(body.query).toBe("image");
  });

  it("filters by service_type", async () => {
    const response = await GET(
      createRequest("/api/registry/services/search?service_type=text_echo"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].name).toBe("Text Echo");
  });

  it("filters by price range", async () => {
    const response = await GET(
      createRequest("/api/registry/services/search?min_price=1.00&max_price=2.00"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].name).toBe("Image Generation");
  });

  it("filters by provider_id", async () => {
    const response = await GET(createRequest("/api/registry/services/search?provider_id=prov-002"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(1);
    expect(body.services[0].provider_id).toBe("prov-002");
  });

  it("returns empty array for non-matching query", async () => {
    const response = await GET(createRequest("/api/registry/services/search?q=zzzzz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("supports pagination", async () => {
    const response = await GET(createRequest("/api/registry/services/search?page=1&page_size=2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(2);
  });

  it("sorts by price ascending", async () => {
    const response = await GET(
      createRequest("/api/registry/services/search?sort_by=price&sort_order=asc"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services[0].price_usdc).toBe("0.10");
    expect(body.services[2].price_usdc).toBe("50.00");
  });

  it("returns 400 for invalid page parameter", async () => {
    const response = await GET(createRequest("/api/registry/services/search?page=-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
    expect(body.error.details).toBeDefined();
  });

  it("returns 400 for invalid min_price", async () => {
    const response = await GET(createRequest("/api/registry/services/search?min_price=abc"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
  });

  it("includes provider info in each service result", async () => {
    const response = await GET(createRequest("/api/registry/services/search"));
    const body = await response.json();

    expect(body.services[0]).toHaveProperty("provider_id");
    expect(body.services[0]).toHaveProperty("provider_name");
    expect(body.services[0]).toHaveProperty("provider_address");
    expect(body.services[0]).toHaveProperty("provider_endpoint_url");
  });

  it("returns snake_case fields in response", async () => {
    const response = await GET(createRequest("/api/registry/services/search"));
    const body = await response.json();

    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("page_size");
    expect(body).toHaveProperty("filters_applied");
    expect(body.services[0]).toHaveProperty("service_type");
    expect(body.services[0]).toHaveProperty("price_usdc");
    expect(body.services[0]).toHaveProperty("estimated_time_seconds");
    expect(body.services[0]).toHaveProperty("provider_endpoint_url");
  });
});
