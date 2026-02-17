import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RatingList } from "./RatingList";
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
    created_at: Date.now(),
    ...overrides,
  };
}

describe("RatingList", () => {
  it("shows empty state when no ratings", () => {
    render(
      <RatingList
        ratings={[]}
        total={0}
        page={1}
        limit={10}
      />,
    );
    expect(screen.getByTestId("empty-ratings")).toHaveTextContent(
      "No reviews yet",
    );
  });

  it("renders rating cards", () => {
    const ratings = [
      makeRating({ rating_id: "r-1" }),
      makeRating({ rating_id: "r-2" }),
    ];
    render(
      <RatingList
        ratings={ratings}
        total={2}
        page={1}
        limit={10}
      />,
    );
    expect(screen.getAllByTestId("rating-card")).toHaveLength(2);
  });

  it("renders sort buttons", () => {
    render(
      <RatingList
        ratings={[makeRating()]}
        total={1}
        page={1}
        limit={10}
      />,
    );
    expect(screen.getByTestId("sort-newest")).toBeInTheDocument();
    expect(screen.getByTestId("sort-highest")).toBeInTheDocument();
    expect(screen.getByTestId("sort-lowest")).toBeInTheDocument();
    expect(screen.getByTestId("sort-oldest")).toBeInTheDocument();
  });

  it("calls onSortChange when sort button clicked", () => {
    const onSortChange = vi.fn();
    render(
      <RatingList
        ratings={[makeRating()]}
        total={1}
        page={1}
        limit={10}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByTestId("sort-highest"));
    expect(onSortChange).toHaveBeenCalledWith("highest");
  });

  it("shows pagination when multiple pages", () => {
    render(
      <RatingList
        ratings={[makeRating()]}
        total={25}
        page={1}
        limit={10}
      />,
    );
    expect(screen.getByTestId("rating-pagination")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("does not show pagination for single page", () => {
    render(
      <RatingList
        ratings={[makeRating()]}
        total={5}
        page={1}
        limit={10}
      />,
    );
    expect(
      screen.queryByTestId("rating-pagination"),
    ).not.toBeInTheDocument();
  });

  it("calls onPageChange when next clicked", () => {
    const onPageChange = vi.fn();
    render(
      <RatingList
        ratings={[makeRating()]}
        total={25}
        page={1}
        limit={10}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Previous on first page", () => {
    render(
      <RatingList
        ratings={[makeRating()]}
        total={25}
        page={1}
        limit={10}
      />,
    );
    expect(screen.getByText("Previous")).toBeDisabled();
  });

  it("disables Next on last page", () => {
    render(
      <RatingList
        ratings={[makeRating()]}
        total={25}
        page={3}
        limit={10}
      />,
    );
    expect(screen.getByText("Next")).toBeDisabled();
  });
});
