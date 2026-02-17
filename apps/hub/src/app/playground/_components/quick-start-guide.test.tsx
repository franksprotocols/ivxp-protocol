import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuickStartGuide } from "./quick-start-guide";
import { PLAYGROUND_STEPS } from "./playground-constants";

describe("QuickStartGuide", () => {
  it("renders the quick start guide", () => {
    render(<QuickStartGuide />);
    expect(screen.getByTestId("quick-start-guide")).toBeInTheDocument();
  });

  it("displays the title", () => {
    render(<QuickStartGuide />);
    expect(screen.getByText("Quick Start Guide")).toBeInTheDocument();
  });

  it("renders all steps", () => {
    render(<QuickStartGuide />);
    for (const step of PLAYGROUND_STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("renders steps as an ordered list", () => {
    render(<QuickStartGuide />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list.children).toHaveLength(PLAYGROUND_STEPS.length);
  });
});
