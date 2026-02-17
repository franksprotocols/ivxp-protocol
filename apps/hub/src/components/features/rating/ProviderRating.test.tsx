import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderRating } from "./ProviderRating";

describe("ProviderRating", () => {
  it("shows 'No ratings yet' when count is 0", () => {
    render(
      <ProviderRating averageRating={0} ratingCount={0} />,
    );
    expect(screen.getByTestId("no-ratings")).toHaveTextContent(
      "No ratings yet",
    );
  });

  it("renders compact variant with average and count", () => {
    render(
      <ProviderRating
        averageRating={4.5}
        ratingCount={12}
        variant="compact"
      />,
    );
    expect(screen.getByTestId("provider-rating-compact")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("renders full variant with distribution", () => {
    const distribution = { 1: 1, 2: 0, 3: 2, 4: 4, 5: 5 };
    render(
      <ProviderRating
        averageRating={4.0}
        ratingCount={12}
        distribution={distribution}
        variant="full"
      />,
    );
    expect(screen.getByTestId("provider-rating-full")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("12 ratings")).toBeInTheDocument();
    expect(screen.getByTestId("rating-distribution")).toBeInTheDocument();
  });

  it("shows singular 'rating' for count of 1", () => {
    render(
      <ProviderRating
        averageRating={5.0}
        ratingCount={1}
        variant="full"
      />,
    );
    expect(screen.getByText("1 rating")).toBeInTheDocument();
  });
});
