import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("renders the IVXP brand name", () => {
    render(<Logo />);
    expect(screen.getByText("IVXP")).toBeInTheDocument();
  });

  it("renders as a link to the home page", () => {
    render(<Logo />);
    const link = screen.getByRole("link", { name: /ivxp/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("has an aria-label describing the link purpose", () => {
    render(<Logo />);
    const link = screen.getByRole("link", { name: /ivxp/i });
    expect(link).toHaveAttribute("aria-label", "IVXP - Go to homepage");
  });
});
