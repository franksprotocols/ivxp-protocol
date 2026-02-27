import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, DELETE } from "../route";
import { resetStore, createAdapter, updateAdapterStatus } from "@/lib/adapter-store";
import { VALID_ADAPTER_INPUT, OPERATOR_SECRET } from "@/lib/__tests__/fixtures";

beforeEach(() => {
  resetStore();
  vi.stubEnv("HUB_OPERATOR_SECRET", OPERATOR_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(method: string, id: string, token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(new URL(`/api/adapters/${id}`, "http://localhost:3000"), {
    method,
    headers,
  });
}

describe("GET /api/adapters/[id]", () => {
  it("returns published adapter by id wrapped in data envelope", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });
    const res = await GET(makeRequest("GET", entry.id), makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.id).toBe(entry.id);
    expect(data.data.name).toBe(VALID_ADAPTER_INPUT.name);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET(makeRequest("GET", "nonexistent"), makeParams("nonexistent"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for non-published adapter", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    // entry is pending_audit by default
    const res = await GET(makeRequest("GET", entry.id), makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for rejected adapter", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "rejected", {
      auditResult: false,
      rejectionReason: "Tests failed",
    });

    const res = await GET(makeRequest("GET", entry.id), makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("strips rejectionReason from published response", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });
    const res = await GET(makeRequest("GET", entry.id), makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).not.toHaveProperty("rejectionReason");
  });
});

describe("DELETE /api/adapters/[id]", () => {
  it("returns 401 without auth", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await DELETE(makeRequest("DELETE", entry.id), makeParams(entry.id));

    expect(res.status).toBe(401);
  });

  it("returns 401 when HUB_OPERATOR_SECRET is not set", async () => {
    vi.stubEnv("HUB_OPERATOR_SECRET", "");
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await DELETE(makeRequest("DELETE", entry.id, "any-token"), makeParams(entry.id));

    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await DELETE(
      makeRequest("DELETE", entry.id, OPERATOR_SECRET),
      makeParams(entry.id),
    );

    expect(res.status).toBe(204);
  });

  it("returns 404 for unknown id", async () => {
    const res = await DELETE(
      makeRequest("DELETE", "nonexistent", OPERATOR_SECRET),
      makeParams("nonexistent"),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });
});
