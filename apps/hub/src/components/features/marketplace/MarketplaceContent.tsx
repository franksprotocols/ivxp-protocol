"use client";

import { useServices } from "@/hooks/use-services";
import { ServiceSearch, ServiceFilters, ServiceGrid } from "@/components/features/marketplace";

export function MarketplaceContent() {
  const {
    filteredServices,
    isLoading,
    error,
    searchQuery,
    activeCategory,
    setSearchQuery,
    setActiveCategory,
  } = useServices();

  const emptyMessage =
    searchQuery.trim() !== "" || activeCategory !== "All"
      ? "No services match your search or filters"
      : "No services available yet";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" role="alert">
        <p className="text-lg font-medium text-destructive">Failed to load services</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ServiceFilters activeCategory={activeCategory} onChange={setActiveCategory} />
        <div className="w-full sm:max-w-xs">
          <ServiceSearch value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>
      <ServiceGrid services={filteredServices} isLoading={isLoading} emptyMessage={emptyMessage} />
    </div>
  );
}
