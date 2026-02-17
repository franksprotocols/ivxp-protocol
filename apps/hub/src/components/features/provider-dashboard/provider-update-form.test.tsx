import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderUpdateForm } from "./provider-update-form";
import { useProviderUpdate } from "@/hooks/use-provider-update";
import type { RegistryProviderWire } from "@/lib/registry/types";

vi.mock("@/hooks/use-provider-update", () => ({
  useProviderUpdate: vi.fn(() => ({
    update: vi.fn(),
    state: "idle",
    error: null,
    reset: vi.fn(),
  })),
}));

const baseProvider: RegistryProviderWire = {
  provider_id: "prov-001",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  name: "Test Provider",
  description: "A test provider description",
  endpoint_url: "https://test.example.com",
  services: [],
  status: "active",
  verification_status: "verified",
  last_verified_at: "2026-02-01T00:00:00Z",
  last_check_at: "2026-02-01T00:00:00Z",
  consecutive_failures: 0,
  registered_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

const mockedUseProviderUpdate = vi.mocked(useProviderUpdate);

describe("ProviderUpdateForm", () => {
  beforeEach(() => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "idle",
      error: null,
      reset: vi.fn(),
    });
  });

  it("pre-populates form with current provider data", () => {
    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);

    expect(screen.getByDisplayValue("Test Provider")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A test provider description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://test.example.com")).toBeInTheDocument();
  });

  it("renders Update Provider button", () => {
    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    expect(screen.getByText("Update Provider")).toBeInTheDocument();
  });

  it("shows signing explanation when state is signing", () => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "signing",
      error: null,
      reset: vi.fn(),
    });

    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    expect(screen.getByText("Sign Update Message")).toBeInTheDocument();
    expect(screen.getByText(/free and requires no gas/)).toBeInTheDocument();
  });

  it("shows error alert with retry button on signature rejection", () => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "error",
      error: {
        code: "SIGNATURE_REJECTED",
        message: "Signature was rejected. Please try again to sign the update message.",
      },
      reset: vi.fn(),
    });

    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    expect(screen.getByText("Update Failed")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows error alert for API errors", () => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "error",
      error: { code: "PROVIDER_UNREACHABLE", message: "Endpoint not reachable" },
      reset: vi.fn(),
    });

    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    expect(screen.getByText("Update Failed")).toBeInTheDocument();
    expect(screen.getByText("Endpoint not reachable")).toBeInTheDocument();
  });

  it("shows success alert when update succeeds", () => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "success",
      error: null,
      reset: vi.fn(),
    });

    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    expect(screen.getByText("Provider Updated")).toBeInTheDocument();
  });

  it("disables form fields during submission", () => {
    mockedUseProviderUpdate.mockReturnValue({
      update: vi.fn(),
      state: "submitting",
      error: null,
      reset: vi.fn(),
    });

    render(<ProviderUpdateForm provider={baseProvider} onSuccess={vi.fn()} />);
    const nameInput = screen.getByDisplayValue("Test Provider");
    expect(nameInput).toBeDisabled();
  });
});
