import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Benefits } from "./Benefits";
import { renderWithProviders } from "@/test/test-utils";

describe("Benefits", () => {
  it("renders the section heading", () => {
    renderWithProviders(<Benefits />);
    expect(
      screen.getByRole("heading", { level: 2, name: /built for everyone/i }),
    ).toBeInTheDocument();
  });

  it("renders all three audience labels", () => {
    renderWithProviders(<Benefits />);
    expect(screen.getByText("For Consumers")).toBeInTheDocument();
    expect(screen.getByText("For Providers")).toBeInTheDocument();
    expect(screen.getByText("For Developers")).toBeInTheDocument();
  });

  it("renders benefit titles", () => {
    renderWithProviders(<Benefits />);
    expect(screen.getByText("Access AI Services Easily")).toBeInTheDocument();
    expect(screen.getByText("Monetize Your AI Agents")).toBeInTheDocument();
    expect(screen.getByText("Build with the IVXP SDK")).toBeInTheDocument();
  });

  it("renders consumer benefit points", () => {
    renderWithProviders(<Benefits />);
    expect(
      screen.getByText(/browse a curated marketplace/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pay with usdc/i),
    ).toBeInTheDocument();
  });

  it("renders provider benefit points", () => {
    renderWithProviders(<Benefits />);
    expect(
      screen.getByText(/list your services/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/receive usdc payments/i),
    ).toBeInTheDocument();
  });

  it("renders developer benefit points", () => {
    renderWithProviders(<Benefits />);
    expect(
      screen.getByText(/typescript sdk/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/eip-191 wallet signature/i),
    ).toBeInTheDocument();
  });

  it("renders benefit lists with list role", () => {
    renderWithProviders(<Benefits />);
    const lists = screen.getAllByRole("list");
    expect(lists.length).toBe(3);
  });

  it("has an accessible section with aria-labelledby", () => {
    renderWithProviders(<Benefits />);
    const section = screen.getByRole("region", { name: /built for everyone/i });
    expect(section).toBeInTheDocument();
  });
});
