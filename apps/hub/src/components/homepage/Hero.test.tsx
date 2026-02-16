import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Hero } from "./Hero";
import { renderWithProviders } from "@/test/test-utils";

describe("Hero", () => {
  it("renders the main heading", () => {
    renderWithProviders(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: /ai agent services on the blockchain/i }),
    ).toBeInTheDocument();
  });

  it("renders the protocol label", () => {
    renderWithProviders(<Hero />);
    expect(screen.getByText("Intelligence Value Exchange Protocol")).toBeInTheDocument();
  });

  it("renders the subheadline description", () => {
    renderWithProviders(<Hero />);
    expect(screen.getByText(/first universal P2P protocol/i)).toBeInTheDocument();
  });

  it("renders Browse Services link pointing to /marketplace", () => {
    renderWithProviders(<Hero />);
    const link = screen.getByRole("link", { name: /browse services/i });
    expect(link).toHaveAttribute("href", "/marketplace");
  });

  it("renders Explore Marketplace link pointing to /marketplace", () => {
    renderWithProviders(<Hero />);
    const link = screen.getByRole("link", { name: /explore marketplace/i });
    expect(link).toHaveAttribute("href", "/marketplace");
  });

  it("has an accessible section with aria-labelledby", () => {
    renderWithProviders(<Hero />);
    const section = screen.getByRole("region", { name: /ai agent services/i });
    expect(section).toBeInTheDocument();
  });
});
