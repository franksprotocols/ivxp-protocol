import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Features } from "./Features";
import { renderWithProviders } from "@/test/test-utils";

describe("Features", () => {
  it("renders the section heading", () => {
    renderWithProviders(<Features />);
    expect(screen.getByRole("heading", { level: 2, name: /built for trust/i })).toBeInTheDocument();
  });

  it("renders all four feature titles", () => {
    renderWithProviders(<Features />);
    expect(screen.getByText("Trust Nothing Architecture")).toBeInTheDocument();
    expect(screen.getByText("USDC Payments")).toBeInTheDocument();
    expect(screen.getByText("Store & Forward")).toBeInTheDocument();
    expect(screen.getByText("Protocol Transparency")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    renderWithProviders(<Features />);
    expect(screen.getByText(/every payment verified on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/pay for services with usdc/i)).toBeInTheDocument();
    expect(screen.getByText(/deliverables are securely stored/i)).toBeInTheDocument();
    expect(screen.getByText(/see every order id/i)).toBeInTheDocument();
  });

  it("renders the section description", () => {
    renderWithProviders(<Features />);
    expect(screen.getByText(/eliminates the need for trust/i)).toBeInTheDocument();
  });

  it("has an accessible section with aria-labelledby", () => {
    renderWithProviders(<Features />);
    const section = screen.getByRole("region", { name: /built for trust/i });
    expect(section).toBeInTheDocument();
  });
});
