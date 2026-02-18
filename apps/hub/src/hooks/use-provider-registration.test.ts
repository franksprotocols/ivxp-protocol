import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProviderRegistration } from "./use-provider-registration";

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_SIGNATURE = "0xmocksignature";

const mockSignMessageAsync = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: MOCK_ADDRESS }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/lib/registry/verify-signature", () => ({
  buildRegistrationMessage: vi.fn(() => "IVXP Provider Registration\nmock message"),
}));

const validFormData = {
  name: "Test Provider",
  description: "A test provider for IVXP protocol",
  endpointUrl: "https://provider.example.com",
  services: [
    {
      serviceType: "text_echo",
      name: "Text Echo",
      description: "Echoes text back",
      priceUsdc: "1.50",
      estimatedTimeSeconds: 60,
    },
  ],
};

function mockFetchSuccess() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        provider: {
          provider_id: "prov-test-uuid",
          provider_address: MOCK_ADDRESS,
          name: "Test Provider",
          status: "active",
        },
      }),
  });
}

function mockFetchError(status: number, code: string, message: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code, message } }),
  });
}

describe("useProviderRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignMessageAsync.mockResolvedValue(MOCK_SIGNATURE);
    mockFetchSuccess();
  });

  it("starts in idle state with no error", () => {
    const { result } = renderHook(() => useProviderRegistration());
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("transitions through signing -> submitting -> success on happy path", async () => {
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("success");
    expect(result.current.error).toBeNull();
    expect(mockSignMessageAsync).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/registry/providers",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockRouterPush).toHaveBeenCalledWith("/provider");
  });

  it("sends correct wire format payload", async () => {
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.provider_address).toBe(MOCK_ADDRESS);
    expect(body.name).toBe("Test Provider");
    expect(body.endpoint_url).toBe("https://provider.example.com");
    expect(body.services[0].service_type).toBe("text_echo");
    expect(body.services[0].price_usdc).toBe("1.50");
    expect(body.services[0].estimated_time_seconds).toBe(60);
    expect(body.signature).toBe(MOCK_SIGNATURE);
    expect(body.message).toBeDefined();
  });

  it("sets error on signature rejection", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected"));
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("SIGNATURE_REJECTED");
    expect(result.current.error?.message).toBe("Signature rejected. Please try again.");
  });

  it("maps API 401 error to correct message", async () => {
    mockFetchError(401, "SIGNATURE_INVALID", "Bad signature");
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.message).toBe("Signature verification failed. Please try again.");
  });

  it("maps API 409 error to correct message", async () => {
    mockFetchError(409, "PROVIDER_ALREADY_REGISTERED", "Duplicate");
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.message).toBe(
      "A provider with this wallet address is already registered.",
    );
  });

  it("maps API 422 error to correct message", async () => {
    mockFetchError(422, "PROVIDER_UNREACHABLE", "Cannot reach endpoint");
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.message).toContain("not reachable");
  });

  it("maps API 400 error with field details", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: {
            code: "INVALID_PARAMETERS",
            message: "Validation failed",
            details: { name: ["too short"] },
          },
        }),
    });
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.details).toEqual({ name: ["too short"] });
  });

  it("handles network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("NETWORK_ERROR");
  });

  it("reset clears error and returns to idle", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected"));
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });
    expect(result.current.state).toBe("error");

    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("falls back to API message when error code is unknown", async () => {
    mockFetchError(500, "UNKNOWN_CODE", "Something went wrong");
    const { result } = renderHook(() => useProviderRegistration());

    await act(async () => {
      await result.current.register(validFormData);
    });

    expect(result.current.error?.message).toBe("Something went wrong");
  });
});
