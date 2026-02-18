import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import HomePage from "./page";
import { renderWithProviders } from "@/test/test-utils";

describe("HomePage", () => {
  it("renders the hero section", () => {
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /ai agent services on the blockchain/i }),
    ).toBeInTheDocument();
  });

  it("renders the features section", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("heading", { level: 2, name: /built for trust/i })).toBeInTheDocument();
  });

  it("renders the how it works section", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("heading", { level: 2, name: /how it works/i })).toBeInTheDocument();
  });

  it("renders the benefits section", () => {
    renderWithProviders(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /built for everyone/i }),
    ).toBeInTheDocument();
  });

  it("renders Consumer path CTA linking to /marketplace", () => {
    renderWithProviders(<HomePage />);
    const link = screen.getByRole("link", { name: /consumer path/i });
    expect(link).toHaveAttribute("href", "/marketplace");
  });

  it("renders Provider and Developer CTAs", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("link", { name: /provider path/i })).toHaveAttribute(
      "href",
      "/provider",
    );
    expect(screen.getByRole("link", { name: /developer path/i })).toHaveAttribute(
      "href",
      "/playground",
    );
  });

  it("renders role section entries", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("heading", { level: 2, name: /choose your path/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open marketplace/i })).toHaveAttribute(
      "href",
      "/marketplace",
    );
  });

  it("renders all four sections", () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("region", { name: /ai agent services/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /built for trust/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /built for everyone/i })).toBeInTheDocument();
  });
});
