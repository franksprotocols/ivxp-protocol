import useSWR from "swr";
import { useState, useCallback } from "react";
import type {
  ProviderRatingsWire,
  RatingSortOption,
} from "@/lib/ratings/types";

const DEFAULT_LIMIT = 10;

async function fetchRatings(url: string): Promise<ProviderRatingsWire> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ratings: ${res.status}`);
  }
  return res.json();
}

function buildUrl(
  providerAddress: string,
  sort: RatingSortOption,
  page: number,
  limit: number,
): string {
  const params = new URLSearchParams({
    sort,
    page: String(page),
    limit: String(limit),
  });
  return `/api/ratings/${encodeURIComponent(providerAddress)}?${params.toString()}`;
}

interface UseRatingsOptions {
  readonly providerAddress: string;
  readonly initialSort?: RatingSortOption;
  readonly limit?: number;
}

export function useRatings({
  providerAddress,
  initialSort = "newest",
  limit = DEFAULT_LIMIT,
}: UseRatingsOptions) {
  const [sort, setSort] = useState<RatingSortOption>(initialSort);
  const [page, setPage] = useState(1);

  const url = providerAddress
    ? buildUrl(providerAddress, sort, page, limit)
    : null;

  const { data, error, isLoading, mutate } = useSWR<ProviderRatingsWire>(
    url,
    fetchRatings,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );

  const handleSortChange = useCallback((newSort: RatingSortOption) => {
    setSort(newSort);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return {
    data: data ?? null,
    error: error ?? null,
    isLoading,
    sort,
    page,
    onSortChange: handleSortChange,
    onPageChange: handlePageChange,
    refresh: mutate,
  };
}
