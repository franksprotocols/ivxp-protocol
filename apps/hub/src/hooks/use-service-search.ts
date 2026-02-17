"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import type { SearchServicesResponseWire } from "@/lib/registry/types";

export interface UseServiceSearchParams {
  q?: string;
  serviceType?: string;
  minPrice?: string;
  maxPrice?: string;
  providerId?: string;
  sortBy?: "name" | "price" | "relevance";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface UseServiceSearchReturn {
  services: SearchServicesResponseWire["services"];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: Error | undefined;
  setPage: (page: number) => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Build the search URL from parameters, omitting undefined values.
 */
export function buildSearchUrl(params: UseServiceSearchParams): string {
  const searchParams = new URLSearchParams();

  if (params.q) searchParams.set("q", params.q);
  if (params.serviceType) searchParams.set("service_type", params.serviceType);
  if (params.minPrice) searchParams.set("min_price", params.minPrice);
  if (params.maxPrice) searchParams.set("max_price", params.maxPrice);
  if (params.providerId) searchParams.set("provider_id", params.providerId);
  if (params.sortBy) searchParams.set("sort_by", params.sortBy);
  if (params.sortOrder) searchParams.set("sort_order", params.sortOrder);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("page_size", String(params.pageSize));

  const qs = searchParams.toString();
  return `/api/registry/services/search${qs ? `?${qs}` : ""}`;
}

export function useServiceSearch(params: UseServiceSearchParams): UseServiceSearchReturn {
  const [currentPage, setCurrentPage] = useState(params.page ?? 1);

  const url = useMemo(
    () => buildSearchUrl({ ...params, page: currentPage }),
    [params, currentPage],
  );

  const { data, error, isLoading } = useSWR<SearchServicesResponseWire>(url, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return {
    services: data?.services ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? currentPage,
    pageSize: data?.page_size ?? params.pageSize ?? 20,
    isLoading,
    error,
    setPage,
  };
}
