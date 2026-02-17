import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderStatusCard } from "./provider-status-card";
import type { RegistryProviderWire } from "@/lib/registry/types";

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

describe("ProviderStatusCard", () => {
  it("renders provider name and description", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("Test Provider")).toBeInTheDocument();
    expect(screen.getByText("A test provider description")).toBeInTheDocument();
  });

  it("shows Verified badge for verified status", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows Unresponsive badge and warning for unresponsive status", () => {
    render(
      <ProviderStatusCard provider={{ ...baseProvider, verification_status: "unresponsive" }} />,
    );
    expect(screen.getByText("Unresponsive")).toBeInTheDocument();
    expect(screen.getByText("Provider Unresponsive")).toBeInTheDocument();
  });

  it("shows Pending Verification badge for pending status", () => {
    render(<ProviderStatusCard provider={{ ...baseProvider, verification_status: "pending" }} />);
    expect(screen.getByText("Pending Verification")).toBeInTheDocument();
  });

  it("displays truncated wallet address", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("displays endpoint URL", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("https://test.example.com")).toBeInTheDocument();
  });

  it("displays total services count", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("displays registration date", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("Registered")).toBeInTheDocument();
  });

  it("displays last verified date", () => {
    render(<ProviderStatusCard provider={baseProvider} />);
    expect(screen.getByText("Last Verified")).toBeInTheDocument();
  });

  it("shows Never for null last_verified_at", () => {
    render(<ProviderStatusCard provider={{ ...baseProvider, last_verified_at: null }} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });
});
