import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { resetStore, createAdapter, updateAdapterStatus } from "@/lib/adapter-store";
import { VALID_ADAPTER_INPUT } from "@/lib/__tests__/fixtures";

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeGetRequest(query = ""): NextRequest {
  return new NextRequest(new URL(`/api/adapters${query}`, "http://localhost:3000"));
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/adapters", "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/adapters", () => {
  it("returns empty list when no published adapters", async () => {
    const res = await GET(makeGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(0);
    expect(data.meta.total).toBe(0);
  });

  it("returns only published adapters", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });
    // Also create a pending one that should NOT appear
    createAdapter({ ...VALID_ADAPTER_INPUT, name: "Pending" });

    const res = await GET(makeGetRequest());
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].name).toBe("Test Adapter");
    expect(data.meta.total).toBe(1);
  });

  it("paginates with page and limit params", async () => {
    for (let i = 0; i < 5; i++) {
      const e = createAdapter({ ...VALID_ADAPTER_INPUT, name: `Adapter ${i}` });
      updateAdapterStatus(e.id, "published", { auditResult: true });
    }

    const res = await GET(makeGetRequest("?page=2&limit=2"));
    const data = await res.json();

    expect(data.data).toHaveLength(2);
    expect(data.meta.total).toBe(5);
    expect(data.meta.page).toBe(2);
    expect(data.meta.limit).toBe(2);
  });

  it("returns response with name, framework, version, npmPackage, status fields", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });

    const res = await GET(makeGetRequest());
    const data = await res.json();
    const adapter = data.data[0];

    expect(adapter).toHaveProperty("name");
    expect(adapter).toHaveProperty("framework");
    expect(adapter).toHaveProperty("version");
    expect(adapter).toHaveProperty("npmPackage");
    expect(adapter).toHaveProperty("status");
  });

  it("filters by frameworkType query param", async () => {
    const mcp = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(mcp.id, "published", { auditResult: true });

    const a2a = createAdapter({
      ...VALID_ADAPTER_INPUT,
      name: "A2A Adapter",
      npmPackage: "@ivxp/adapter-a2a",
      frameworkType: "A2A",
    });
    updateAdapterStatus(a2a.id, "published", { auditResult: true });

    const res = await GET(makeGetRequest("?frameworkType=MCP"));
    const data = await res.json();

    expect(data.data).toHaveLength(1);
    expect(data.data[0].frameworkType).toBe("MCP");
  });

  it("ignores invalid frameworkType and returns all published", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });

    const res = await GET(makeGetRequest("?frameworkType=InvalidType"));
    const data = await res.json();

    expect(data.data).toHaveLength(1);
  });

  it("returns 0 results for frameworkType with no matching adapters", async () => {
    const mcp = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(mcp.id, "published", { auditResult: true });

    const a2a = createAdapter({
      ...VALID_ADAPTER_INPUT,
      name: "A2A Adapter",
      npmPackage: "@ivxp/adapter-a2a",
      frameworkType: "A2A",
    });
    updateAdapterStatus(a2a.id, "published", { auditResult: true });

    const res = await GET(makeGetRequest("?frameworkType=LangGraph"));
    const data = await res.json();

    expect(data.data).toHaveLength(0);
    expect(data.meta.total).toBe(0);
  });

  it("treats frameworkType=All as invalid and returns all published", async () => {
    const mcp = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(mcp.id, "published", { auditResult: true });

    const a2a = createAdapter({
      ...VALID_ADAPTER_INPUT,
      name: "A2A Adapter",
      npmPackage: "@ivxp/adapter-a2a",
      frameworkType: "A2A",
    });
    updateAdapterStatus(a2a.id, "published", { auditResult: true });

    const res = await GET(makeGetRequest("?frameworkType=All"));
    const data = await res.json();

    expect(data.data).toHaveLength(2);
    expect(data.meta.total).toBe(2);
  });

  it("returns 400 for empty string page param", async () => {
    const res = await GET(makeGetRequest("?page=&limit=20"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });
});

describe("POST /api/adapters", () => {
  it("creates adapter with pending_audit status", async () => {
    const res = await POST(makePostRequest(VALID_ADAPTER_INPUT));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.data.status).toBe("pending_audit");
    expect(data.data.name).toBe(VALID_ADAPTER_INPUT.name);
    expect(data.data.id).toBeDefined();
    expect(data.data.createdAt).toBeDefined();
  });

  it("records frameworkType metadata", async () => {
    const res = await POST(makePostRequest({ ...VALID_ADAPTER_INPUT, frameworkType: "A2A" }));
    const data = await res.json();

    expect(data.data.frameworkType).toBe("A2A");
  });

  it("returns 400 for invalid body (missing name)", async () => {
    const { name: _, ...noName } = VALID_ADAPTER_INPUT;
    const res = await POST(makePostRequest(noName));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(new URL("/api/adapters", "http://localhost:3000"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "not valid json{{{",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 for invalid version format", async () => {
    const res = await POST(makePostRequest({ ...VALID_ADAPTER_INPUT, version: "bad" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid npm package name", async () => {
    const res = await POST(
      makePostRequest({ ...VALID_ADAPTER_INPUT, npmPackage: "INVALID PACKAGE" }),
    );
    expect(res.status).toBe(400);
  });
});
