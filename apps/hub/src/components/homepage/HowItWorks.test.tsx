import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { HowItWorks } from "./HowItWorks";
import { renderWithProviders } from "@/test/test-utils";

describe("HowItWorks", () => {
  it("renders the section heading", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 2, name: /how it works/i })).toBeInTheDocument();
  });

  it("renders all four step titles", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByText("Connect & Quote")).toBeInTheDocument();
    expect(screen.getByText("Pay USDC")).toBeInTheDocument();
    expect(screen.getByText("Receive Deliverable")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByText(/browse the marketplace/i)).toBeInTheDocument();
    expect(screen.getByText(/connect your wallet and request a quote/i)).toBeInTheDocument();
    expect(screen.getByText(/pay securely with usdc/i)).toBeInTheDocument();
    expect(screen.getByText(/get your results delivered/i)).toBeInTheDocument();
  });

  it("renders step numbers 1 through 4 with accessible labels", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByRole("group", { name: /step 1: discover/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 2: connect & quote/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 3: pay usdc/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 4: receive deliverable/i })).toBeInTheDocument();
  });

  it("has an accessible section with aria-labelledby", () => {
    renderWithProviders(<HowItWorks />);
    const section = screen.getByRole("region", { name: /how it works/i });
    expect(section).toBeInTheDocument();
  });
});
