import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarDisplay } from "./StarDisplay";

describe("StarDisplay", () => {
  it("renders 5 stars by default", () => {
    const { container } = render(<StarDisplay rating={3} />);
    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(5);
  });

  it("has correct aria-label", () => {
    render(<StarDisplay rating={4.5} />);
    const element = screen.getByRole("img");
    expect(element).toHaveAttribute("aria-label", "4.5 out of 5 stars");
  });

  it("renders custom number of stars", () => {
    const { container } = render(<StarDisplay rating={3} maxStars={10} />);
    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(10);
  });

  it("clamps rating to maxStars", () => {
    render(<StarDisplay rating={7} maxStars={5} />);
    const element = screen.getByRole("img");
    expect(element).toHaveAttribute("aria-label", "5.0 out of 5 stars");
  });

  it("clamps negative rating to 0", () => {
    render(<StarDisplay rating={-1} />);
    const element = screen.getByRole("img");
    expect(element).toHaveAttribute("aria-label", "0.0 out of 5 stars");
  });

  it("applies size classes", () => {
    const { container } = render(<StarDisplay rating={3} size="lg" />);
    const star = container.querySelector("svg");
    // SVG elements use className.baseVal in jsdom
    const classStr = star?.getAttribute("class") ?? "";
    expect(classStr).toContain("h-5");
    expect(classStr).toContain("w-5");
  });

  it("applies custom className", () => {
    const { container } = render(<StarDisplay rating={3} className="my-custom-class" />);
    expect(container.firstChild).toHaveClass("my-custom-class");
  });
});
