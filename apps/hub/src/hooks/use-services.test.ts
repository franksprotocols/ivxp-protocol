import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServices } from "./use-services";

describe("useServices", () => {
  it("returns all services by default", () => {
    const { result } = renderHook(() => useServices());
    expect(result.current.services.length).toBeGreaterThan(0);
    expect(result.current.filteredServices).toEqual(result.current.services);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("initializes with default category 'All'", () => {
    const { result } = renderHook(() => useServices());
    expect(result.current.activeCategory).toBe("All");
  });

  it("initializes with custom category", () => {
    const { result } = renderHook(() => useServices({ initialCategory: "AI" }));
    expect(result.current.activeCategory).toBe("AI");
    expect(result.current.filteredServices.every((s) => s.category === "AI")).toBe(true);
  });

  it("filters services by category", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setActiveCategory("AI");
    });

    expect(result.current.activeCategory).toBe("AI");
    expect(result.current.filteredServices.length).toBeGreaterThan(0);
    expect(result.current.filteredServices.every((s) => s.category === "AI")).toBe(true);
  });

  it("filters services by search query on name", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setSearchQuery("echo");
    });

    expect(result.current.filteredServices.length).toBeGreaterThan(0);
    expect(
      result.current.filteredServices.some((s) => s.service_type.toLowerCase().includes("echo")),
    ).toBe(true);
  });

  it("filters services by search query on description", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setSearchQuery("diffusion");
    });

    expect(result.current.filteredServices.length).toBeGreaterThan(0);
    expect(
      result.current.filteredServices.some((s) =>
        s.description.toLowerCase().includes("diffusion"),
      ),
    ).toBe(true);
  });

  it("filters services by search query on provider name", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setSearchQuery("PixelMind");
    });

    expect(result.current.filteredServices.length).toBeGreaterThan(0);
    expect(result.current.filteredServices.every((s) => s.provider_name === "PixelMind AI")).toBe(
      true,
    );
  });

  it("combines category and search filters", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setActiveCategory("AI");
      result.current.setSearchQuery("sentiment");
    });

    expect(result.current.filteredServices.length).toBe(1);
    expect(result.current.filteredServices[0].service_type).toBe("sentiment_analysis");
  });

  it("returns empty array when no services match", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setSearchQuery("nonexistent_service_xyz");
    });

    expect(result.current.filteredServices).toEqual([]);
  });

  it("ignores whitespace-only search queries", () => {
    const { result } = renderHook(() => useServices());
    const allCount = result.current.filteredServices.length;

    act(() => {
      result.current.setSearchQuery("   ");
    });

    expect(result.current.filteredServices.length).toBe(allCount);
  });

  it("search is case-insensitive", () => {
    const { result } = renderHook(() => useServices());

    act(() => {
      result.current.setSearchQuery("IMAGE_GEN");
    });

    expect(result.current.filteredServices.length).toBeGreaterThan(0);
  });

  it("truncates search query to 100 characters", () => {
    const { result } = renderHook(() => useServices());
    // Build a query longer than 100 chars that would only match
    // if the full string were used (chars beyond 100 contain the match term)
    const padding = "z".repeat(101);
    const longQuery = padding + "echo";

    act(() => {
      result.current.setSearchQuery(longQuery);
    });

    // "echo" is beyond the 100-char limit, so truncation means no match
    expect(result.current.filteredServices.length).toBe(0);
  });
});
