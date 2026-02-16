"use client";

import { useMemo, useState } from "react";
import type { Service, ServiceCategory } from "@/lib/types/service";
import { MOCK_SERVICES } from "@/lib/mock-data/services";

interface UseServicesOptions {
  readonly initialCategory?: ServiceCategory;
  readonly initialSearch?: string;
}

interface UseServicesResult {
  readonly services: readonly Service[];
  readonly filteredServices: readonly Service[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly searchQuery: string;
  readonly activeCategory: ServiceCategory;
  readonly setSearchQuery: (query: string) => void;
  readonly setActiveCategory: (category: ServiceCategory) => void;
}

const MAX_SEARCH_LENGTH = 100;

function matchesSearch(service: Service, query: string): boolean {
  const lowerQuery = query.slice(0, MAX_SEARCH_LENGTH).toLowerCase();
  const nameMatch = service.service_type.toLowerCase().includes(lowerQuery);
  const descMatch = service.description.toLowerCase().includes(lowerQuery);
  const providerMatch = service.provider_name
    ? service.provider_name.toLowerCase().includes(lowerQuery)
    : false;
  return nameMatch || descMatch || providerMatch;
}

function matchesCategory(service: Service, category: ServiceCategory): boolean {
  if (category === "All") return true;
  return service.category === category;
}

export function useServices(options: UseServicesOptions = {}): UseServicesResult {
  const { initialCategory = "All", initialSearch = "" } = options;

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>(initialCategory);

  // In the future, this will fetch from the registry API.
  // For now, use mock data.
  const services = MOCK_SERVICES;
  const isLoading = false;
  const error = null;

  const filteredServices = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    return services.filter((service) => {
      const categoryMatch = matchesCategory(service, activeCategory);
      const searchMatch = trimmedQuery === "" || matchesSearch(service, trimmedQuery);
      return categoryMatch && searchMatch;
    });
  }, [services, searchQuery, activeCategory]);

  return {
    services,
    filteredServices,
    isLoading,
    error,
    searchQuery,
    activeCategory,
    setSearchQuery,
    setActiveCategory,
  };
}
