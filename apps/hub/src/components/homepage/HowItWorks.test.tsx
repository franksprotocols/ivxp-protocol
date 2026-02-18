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
    expect(screen.getByText("Request Quote")).toBeInTheDocument();
    expect(screen.getByText("Pay + Sign")).toBeInTheDocument();
    expect(screen.getByText("Track Status")).toBeInTheDocument();
    expect(screen.getByText("Verify Download")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByText(/real order_id and price_usdc/i)).toBeInTheDocument();
    expect(screen.getByText(/sign eip-191 identity proof/i)).toBeInTheDocument();
    expect(screen.getByText(/provider-backed status updates/i)).toBeInTheDocument();
    expect(screen.getByText(/verify content_hash/i)).toBeInTheDocument();
  });

  it("renders step numbers 1 through 4 with accessible labels", () => {
    renderWithProviders(<HowItWorks />);
    expect(screen.getByRole("group", { name: /step 1: request quote/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 2: pay \+ sign/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 3: track status/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /step 4: verify download/i })).toBeInTheDocument();
  });

  it("has an accessible section with aria-labelledby", () => {
    renderWithProviders(<HowItWorks />);
    const section = screen.getByRole("region", { name: /how it works/i });
    expect(section).toBeInTheDocument();
  });
});
