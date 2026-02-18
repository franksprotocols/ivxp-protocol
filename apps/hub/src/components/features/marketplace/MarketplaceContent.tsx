"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useServiceSearch } from "@/hooks/use-service-search";
import { ServiceSearch, ServiceGrid } from "@/components/features/marketplace";
import { SearchFilters } from "./SearchFilters";
import { SearchEmptyState } from "./SearchEmptyState";
import type { Service } from "@/lib/types/service";
import type { SearchServiceResultWire } from "@/lib/registry/types";

const DEBOUNCE_MS = 300;

export interface FilterState {
  q: string;
  serviceType: string;
  minPrice: string;
  maxPrice: string;
  providerId: string;
  sortBy: "name" | "price" | "relevance";
  sortOrder: "asc" | "desc";
}

function toService(result: SearchServiceResultWire): Service {
  return {
    service_type: result.service_type,
    description: result.description,
    price_usdc: result.price_usdc,
    provider_address: result.provider_address as `0x${string}`,
    provider_name: result.provider_name,
  };
}

export function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<FilterState>({
    q: searchParams.get("q") ?? "",
    serviceType: searchParams.get("service_type") ?? "",
    minPrice: searchParams.get("min_price") ?? "",
    maxPrice: searchParams.get("max_price") ?? "",
    providerId: searchParams.get("provider_id") ?? "",
    sortBy: (searchParams.get("sort_by") as FilterState["sortBy"]) ?? "relevance",
    sortOrder: (searchParams.get("sort_order") as FilterState["sortOrder"]) ?? "asc",
  });

  const syncUrlParams = useCallback(
    (state: FilterState) => {
      const params = new URLSearchParams();
      if (state.q) params.set("q", state.q);
      if (state.serviceType) params.set("service_type", state.serviceType);
      if (state.minPrice) params.set("min_price", state.minPrice);
      if (state.maxPrice) params.set("max_price", state.maxPrice);
      if (state.providerId) params.set("provider_id", state.providerId);
      if (state.sortBy !== "relevance") params.set("sort_by", state.sortBy);
      if (state.sortOrder !== "asc") params.set("sort_order", state.sortOrder);

      const qs = params.toString();
      if (qs === searchParams.toString()) return;

      router.replace(`/marketplace${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setFilters((prev) => (prev.q === searchInput ? prev : { ...prev, q: searchInput }));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    syncUrlParams(filters);
  }, [filters, syncUrlParams]);

  const { services, total, isLoading, error } = useServiceSearch({
    q: debouncedQuery || undefined,
    serviceType: filters.serviceType || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    providerId: filters.providerId || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    const cleared: FilterState = {
      q: "",
      serviceType: "",
      minPrice: "",
      maxPrice: "",
      providerId: "",
      sortBy: "relevance",
      sortOrder: "asc",
    };
    setSearchInput("");
    setDebouncedQuery("");
    setFilters(cleared);
  }, []);

  const hasFilters =
    debouncedQuery !== "" ||
    filters.serviceType !== "" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.providerId !== "";

  const mappedServices: readonly Service[] = useMemo(() => services.map(toService), [services]);

  const emptyMessage = hasFilters
    ? "No services match your search or filters"
    : "No services available yet";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
        <p className="text-lg font-medium text-destructive">Failed to load services</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={handleClearFilters}
          />
          <div className="w-full sm:max-w-xs">
            <ServiceSearch value={searchInput} onChange={setSearchInput} />
          </div>
        </div>
      </div>
      {!isLoading && services.length === 0 && hasFilters ? (
        <SearchEmptyState
          query={debouncedQuery}
          hasFilters={hasFilters}
          onClearFilters={handleClearFilters}
        />
      ) : (
        <ServiceGrid services={mappedServices} isLoading={isLoading} emptyMessage={emptyMessage} />
      )}
      {total > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Showing {services.length} of {total} services
        </p>
      )}
    </div>
  );
}
