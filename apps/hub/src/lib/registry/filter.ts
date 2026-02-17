import type { RegistryProviderWire } from "./types";
import type { ListProvidersQueryParsed } from "./schemas";

/**
 * Filter providers by service_type.
 * Returns only providers that offer at least one service matching the type.
 */
export function filterByServiceType(
  providers: readonly RegistryProviderWire[],
  serviceType: string,
): RegistryProviderWire[] {
  return providers.filter((p) =>
    p.services.some((s) => s.service_type.toLowerCase() === serviceType.toLowerCase()),
  );
}

/**
 * Filter providers by text search query.
 * Matches against provider name, description, and service names/descriptions.
 */
export function filterBySearchQuery(
  providers: readonly RegistryProviderWire[],
  query: string,
): RegistryProviderWire[] {
  const lowerQuery = query.toLowerCase();
  return providers.filter((p) => {
    const nameMatch = p.name.toLowerCase().includes(lowerQuery);
    const descMatch = p.description.toLowerCase().includes(lowerQuery);
    const serviceMatch = p.services.some(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery) ||
        s.service_type.toLowerCase().includes(lowerQuery),
    );
    return nameMatch || descMatch || serviceMatch;
  });
}

/**
 * Filter providers by status.
 */
export function filterByStatus(
  providers: readonly RegistryProviderWire[],
  status: "active" | "inactive",
): RegistryProviderWire[] {
  return providers.filter((p) => p.status === status);
}

/**
 * Sort providers by the specified field and order.
 */
export function sortProviders(
  providers: readonly RegistryProviderWire[],
  sortBy: "name" | "service_count",
  sortOrder: "asc" | "desc",
): RegistryProviderWire[] {
  const sorted = [...providers].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    return a.services.length - b.services.length;
  });

  return sortOrder === "desc" ? sorted.reverse() : sorted;
}

/**
 * Paginate an array of providers.
 * Returns the slice for the requested page and the total count.
 */
export function paginateProviders(
  providers: readonly RegistryProviderWire[],
  page: number,
  pageSize: number,
): { items: RegistryProviderWire[]; total: number } {
  const total = providers.length;
  const start = (page - 1) * pageSize;
  const items = providers.slice(start, start + pageSize);
  return { items, total };
}

/**
 * Apply all query filters, sorting, and pagination in sequence.
 */
export function queryProviders(
  providers: readonly RegistryProviderWire[],
  query: ListProvidersQueryParsed,
): { items: RegistryProviderWire[]; total: number } {
  let result: readonly RegistryProviderWire[] = providers;

  if (query.status) {
    result = filterByStatus(result, query.status);
  }

  if (query.service_type) {
    result = filterByServiceType(result, query.service_type);
  }

  if (query.q) {
    result = filterBySearchQuery(result, query.q);
  }

  result = sortProviders(result, query.sort_by, query.sort_order);

  return paginateProviders(result, query.page, query.page_size);
}
