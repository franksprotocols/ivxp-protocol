import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { resetStore, createAdapter, updateAdapterStatus, getAdapter } from "@/lib/adapter-store";
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

function makePostRequest(id: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest(new URL(`/api/adapters/${id}/audit`, "http://localhost:3000"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/adapters/[id]/audit", () => {
  it("returns 401 without auth", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await POST(makePostRequest(entry.id, { passed: true }), makeParams(entry.id));

    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown adapter", async () => {
    const res = await POST(
      makePostRequest("nonexistent", { passed: true }, OPERATOR_SECRET),
      makeParams("nonexistent"),
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error.code).toBe("NOT_FOUND");
  });

  it("transitions to published when passed is true", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await POST(
      makePostRequest(entry.id, { passed: true }, OPERATOR_SECRET),
      makeParams(entry.id),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.status).toBe("published");
    expect(data.data.auditResult).toBe(true);
  });

  it("transitions to rejected when passed is false with reason", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await POST(
      makePostRequest(entry.id, { passed: false, reason: "Interop tests failed" }, OPERATOR_SECRET),
      makeParams(entry.id),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.status).toBe("rejected");
    expect(data.data.auditResult).toBe(false);
    expect(data.data.rejectionReason).toBe("Interop tests failed");
  });

  it("returns 409 if adapter is already published", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "published", { auditResult: true });

    const res = await POST(
      makePostRequest(entry.id, { passed: true }, OPERATOR_SECRET),
      makeParams(entry.id),
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error.code).toBe("CONFLICT");
    expect(data.error.message).toBe("Adapter has already been audited and cannot be re-audited.");
  });

  it("returns 409 if adapter is already rejected", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    updateAdapterStatus(entry.id, "rejected", {
      auditResult: false,
      rejectionReason: "Failed",
    });

    const res = await POST(
      makePostRequest(entry.id, { passed: true }, OPERATOR_SECRET),
      makeParams(entry.id),
    );

    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid body (missing passed)", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const res = await POST(makePostRequest(entry.id, {}, OPERATOR_SECRET), makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 400 for invalid JSON", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    const req = new NextRequest(
      new URL(`/api/adapters/${entry.id}/audit`, "http://localhost:3000"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPERATOR_SECRET}`,
        },
        body: "not valid json{{{",
      },
    );
    const res = await POST(req, makeParams(entry.id));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_JSON");
  });

  it("persists status change in store", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    await POST(makePostRequest(entry.id, { passed: true }, OPERATOR_SECRET), makeParams(entry.id));

    const stored = getAdapter(entry.id);
    expect(stored?.status).toBe("published");
  });
});
