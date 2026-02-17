import type { SearchServiceResultWire } from "./types";
import type { SearchServicesQueryParsed } from "./search-schemas";

/**
 * Compute a relevance score for a service against a search query.
 * Higher score = better match. Weights: name > service_type > description.
 */
export function computeRelevanceScore(service: SearchServiceResultWire, query: string): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;

  // Exact name match (highest weight)
  if (service.name.toLowerCase() === lowerQuery) {
    score += 100;
  } else if (service.name.toLowerCase().includes(lowerQuery)) {
    score += 50;
  }

  // Service type match
  if (service.service_type.toLowerCase().includes(lowerQuery)) {
    score += 30;
  }

  // Description match
  if (service.description.toLowerCase().includes(lowerQuery)) {
    score += 10;
  }

  // Provider name match (bonus)
  if (service.provider_name.toLowerCase().includes(lowerQuery)) {
    score += 5;
  }

  return score;
}

/**
 * Filter services by text search query.
 * Returns services with relevance_score > 0.
 */
export function searchServicesByText(
  services: readonly SearchServiceResultWire[],
  query: string,
): SearchServiceResultWire[] {
  return services
    .map((service) => ({
      ...service,
      relevance_score: computeRelevanceScore(service, query),
    }))
    .filter((s) => (s.relevance_score ?? 0) > 0);
}

/**
 * Filter services by exact service_type match (case-insensitive).
 */
export function filterServicesByType(
  services: readonly SearchServiceResultWire[],
  serviceType: string,
): SearchServiceResultWire[] {
  return services.filter((s) => s.service_type.toLowerCase() === serviceType.toLowerCase());
}

/**
 * Filter services by USDC price range.
 */
export function filterServicesByPriceRange(
  services: readonly SearchServiceResultWire[],
  minPrice?: string,
  maxPrice?: string,
): SearchServiceResultWire[] {
  return services.filter((s) => {
    const price = parseFloat(s.price_usdc);

    // Skip services with invalid prices
    if (isNaN(price)) {
      console.warn(`Invalid price_usdc for service ${s.service_type}: "${s.price_usdc}"`);
      return false;
    }

    if (minPrice !== undefined) {
      const min = parseFloat(minPrice);
      if (isNaN(min)) {
        console.warn(`Invalid minPrice filter: "${minPrice}"`);
        return true; // Don't filter out if filter value is invalid
      }
      if (price < min) return false;
    }

    if (maxPrice !== undefined) {
      const max = parseFloat(maxPrice);
      if (isNaN(max)) {
        console.warn(`Invalid maxPrice filter: "${maxPrice}"`);
        return true; // Don't filter out if filter value is invalid
      }
      if (price > max) return false;
    }

    return true;
  });
}

/**
 * Filter services by provider_id.
 */
export function filterServicesByProvider(
  services: readonly SearchServiceResultWire[],
  providerId: string,
): SearchServiceResultWire[] {
  return services.filter((s) => s.provider_id === providerId);
}

/**
 * Sort services by the specified field and order.
 */
export function sortServices(
  services: readonly SearchServiceResultWire[],
  sortBy: "name" | "price" | "relevance",
  sortOrder: "asc" | "desc",
): SearchServiceResultWire[] {
  const sorted = [...services].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "price") {
      const priceA = parseFloat(a.price_usdc);
      const priceB = parseFloat(b.price_usdc);

      // Handle NaN: treat as highest value to push to end
      if (isNaN(priceA) && isNaN(priceB)) return 0;
      if (isNaN(priceA)) return 1;
      if (isNaN(priceB)) return -1;

      return priceA - priceB;
    }
    // relevance (higher is better, so reverse default)
    return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
  });

  // For relevance, "asc" means lowest first (unusual), "desc" means highest first (default)
  if (sortBy === "relevance") {
    return sortOrder === "asc" ? sorted.reverse() : sorted;
  }

  return sortOrder === "desc" ? sorted.reverse() : sorted;
}

/**
 * Paginate an array of services.
 */
export function paginateServices(
  services: readonly SearchServiceResultWire[],
  page: number,
  pageSize: number,
): { items: SearchServiceResultWire[]; total: number } {
  const total = services.length;
  const start = (page - 1) * pageSize;
  const items = services.slice(start, start + pageSize);
  return { items, total };
}

/**
 * Apply all query filters, sorting, and pagination in sequence.
 */
export function queryServices(
  services: readonly SearchServiceResultWire[],
  query: SearchServicesQueryParsed,
): { items: SearchServiceResultWire[]; total: number } {
  let result: SearchServiceResultWire[] = [...services];

  // 1. Text search (adds relevance_score)
  if (query.q) {
    result = searchServicesByText(result, query.q);
  }

  // 2. Filter by service_type
  if (query.service_type) {
    result = filterServicesByType(result, query.service_type);
  }

  // 3. Filter by price range
  if (query.min_price || query.max_price) {
    result = filterServicesByPriceRange(result, query.min_price, query.max_price);
  }

  // 4. Filter by provider
  if (query.provider_id) {
    result = filterServicesByProvider(result, query.provider_id);
  }

  // 5. Determine sort: use relevance when query present, otherwise use specified or name
  const effectiveSortBy = query.q && query.sort_by === "relevance" ? "relevance" : query.sort_by;
  const effectiveSortOrder = effectiveSortBy === "relevance" ? "desc" : query.sort_order;

  result = sortServices(result, effectiveSortBy, effectiveSortOrder);

  // 6. Paginate
  return paginateServices(result, query.page, query.page_size);
}
