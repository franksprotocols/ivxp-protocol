import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingDistribution } from "./RatingDistribution";

describe("RatingDistribution", () => {
  it("renders all 5 star levels", () => {
    const distribution = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
    render(<RatingDistribution distribution={distribution} totalCount={15} />);
    expect(screen.getByTestId("rating-distribution")).toBeInTheDocument();
    // Check all 5 progress bars are rendered
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(5);
    // Verify accessible labels exist for each level
    expect(screen.getByLabelText(/5 star/)).toBeInTheDocument();
    expect(screen.getByLabelText(/4 star/)).toBeInTheDocument();
    expect(screen.getByLabelText(/3 star/)).toBeInTheDocument();
    expect(screen.getByLabelText(/2 star/)).toBeInTheDocument();
    expect(screen.getByLabelText(/1 star/)).toBeInTheDocument();
  });

  it("renders correct counts", () => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 10 };
    render(<RatingDistribution distribution={distribution} totalCount={10} />);
    // The count "10" should appear for 5-star
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("handles zero total count without errors", () => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const { container } = render(<RatingDistribution distribution={distribution} totalCount={0} />);
    // All progress bars should have 0% width
    const bars = container.querySelectorAll("[role='progressbar']");
    expect(bars).toHaveLength(5);
    bars.forEach((bar) => {
      expect(bar).toHaveAttribute("aria-valuenow", "0");
    });
  });

  it("has accessible labels on progress bars", () => {
    const distribution = { 1: 2, 2: 0, 3: 0, 4: 0, 5: 8 };
    render(<RatingDistribution distribution={distribution} totalCount={10} />);
    expect(screen.getByLabelText("5 star: 8 ratings")).toBeInTheDocument();
    expect(screen.getByLabelText("1 star: 2 ratings")).toBeInTheDocument();
  });
});
