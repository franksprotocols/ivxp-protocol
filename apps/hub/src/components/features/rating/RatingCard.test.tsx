import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingCard } from "./RatingCard";
import type { RatingWire } from "@/lib/ratings/types";

function makeRating(overrides: Partial<RatingWire> = {}): RatingWire {
  return {
    rating_id: "r-1",
    order_id: "o-1",
    provider_address: "0xAAA",
    service_type: "text_echo",
    client_address: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    stars: 4,
    review_text: "Good service",
    signature: "0xsig",
    created_at: Date.now() - 60_000,
    ...overrides,
  };
}

describe("RatingCard", () => {
  it("renders star rating", () => {
    render(<RatingCard rating={makeRating({ stars: 4 })} />);
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("renders review text", () => {
    render(<RatingCard rating={makeRating({ review_text: "Great!" })} />);
    expect(screen.getByText("Great!")).toBeInTheDocument();
  });

  it("renders relative timestamp", () => {
    render(<RatingCard rating={makeRating()} />);
    const timeEl = screen.getByRole("time" as string) ?? screen.getByText(/ago/);
    expect(timeEl).toBeInTheDocument();
  });

  it("renders truncated client address", () => {
    render(<RatingCard rating={makeRating()} />);
    expect(screen.getByText(/0xBBBB/)).toBeInTheDocument();
  });

  it("shows Read more button for long reviews", () => {
    const longText = "A".repeat(250);
    render(<RatingCard rating={makeRating({ review_text: longText })} />);
    expect(screen.getByTestId("read-more-button")).toBeInTheDocument();
    expect(screen.getByText("Read more")).toBeInTheDocument();
  });

  it("expands text on Read more click", () => {
    const longText = "A".repeat(250);
    render(<RatingCard rating={makeRating({ review_text: longText })} />);
    fireEvent.click(screen.getByTestId("read-more-button"));
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("does not show Read more for short reviews", () => {
    render(
      <RatingCard rating={makeRating({ review_text: "Short" })} />,
    );
    expect(screen.queryByTestId("read-more-button")).not.toBeInTheDocument();
  });

  it("handles missing review text", () => {
    render(
      <RatingCard rating={makeRating({ review_text: undefined })} />,
    );
    expect(screen.getByTestId("rating-card")).toBeInTheDocument();
  });
});
