import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DemoProviderInfo } from "./demo-provider-info";

describe("DemoProviderInfo", () => {
  const mockUrl = "https://demo-provider.test";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the demo provider info card", () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ services: [] }), { status: 200 }),
    );
    render(<DemoProviderInfo url={mockUrl} />);
    expect(screen.getByTestId("demo-provider-info")).toBeInTheDocument();
  });

  it("displays the provider URL", () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ services: [] }), { status: 200 }),
    );
    render(<DemoProviderInfo url={mockUrl} />);
    expect(screen.getByText(mockUrl)).toBeInTheDocument();
  });

  it("shows connecting state initially", () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
    render(<DemoProviderInfo url={mockUrl} />);
    expect(screen.getByTestId("status-connecting")).toBeInTheDocument();
    expect(screen.getByText("Connecting to demo Provider...")).toBeInTheDocument();
  });

  it("shows connected state after successful fetch", async () => {
    const mockServices = [
      {
        service_type: "text_echo",
        description: "Echo service",
        price_usdc: "0.50",
        provider_address: "0x1234",
        input_schema: { type: "object", properties: {} },
        output_schema: { type: "string" },
      },
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ services: mockServices }), {
        status: 200,
      }),
    );

    render(<DemoProviderInfo url={mockUrl} />);

    await waitFor(() => {
      expect(screen.getByTestId("status-connected")).toBeInTheDocument();
    });
    expect(screen.getByText("1 service available")).toBeInTheDocument();
    expect(screen.getByText("text_echo")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    render(<DemoProviderInfo url={mockUrl} />);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("provider-error")).toBeInTheDocument();
  });

  it("calls onCatalogLoaded when services are fetched", async () => {
    const onCatalogLoaded = vi.fn();
    const mockServices = [
      {
        service_type: "ping_test",
        description: "Ping",
        price_usdc: "0.10",
        provider_address: "0x1234",
        input_schema: { type: "object", properties: {} },
        output_schema: { type: "string" },
      },
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ services: mockServices }), {
        status: 200,
      }),
    );

    render(<DemoProviderInfo url={mockUrl} onCatalogLoaded={onCatalogLoaded} />);

    await waitFor(() => {
      expect(onCatalogLoaded).toHaveBeenCalledWith(mockServices);
    });
  });

  it("shows error on non-OK HTTP response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    render(<DemoProviderInfo url={mockUrl} />);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("provider-error").textContent).toContain("HTTP 404");
  });

  it("shows timeout-specific error message on AbortError", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

    render(<DemoProviderInfo url={mockUrl} />);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("provider-error").textContent).toContain("timed out");
  });

  it("shows network-specific error message on TypeError", async () => {
    const networkError = new TypeError("Failed to fetch");
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(networkError);

    render(<DemoProviderInfo url={mockUrl} />);

    await waitFor(() => {
      expect(screen.getByTestId("status-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("provider-error").textContent).toContain("Network error");
  });
});
