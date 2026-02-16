import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders the footer element", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("displays copyright information", () => {
    render(<Footer />);
    expect(screen.getByText(/ivxp protocol/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it("renders a link to documentation", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /docs/i })).toBeInTheDocument();
  });

  it("renders a link to GitHub", () => {
    render(<Footer />);
    const githubLink = screen.getByRole("link", { name: /github/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders a link to community/Discord", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /community/i })).toBeInTheDocument();
  });

  it("uses responsive flex layout for mobile and desktop", () => {
    render(<Footer />);
    const container = screen.getByRole("contentinfo").firstElementChild;
    expect(container).toHaveClass("flex-col");
    expect(container).toHaveClass("sm:flex-row");
    expect(container).toHaveClass("sm:justify-between");
  });
});
