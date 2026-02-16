import type { Service } from "@/lib/types/service";
import { ServiceCard } from "./ServiceCard";

interface ServiceGridProps {
  readonly services: readonly Service[];
  readonly isLoading: boolean;
  readonly emptyMessage?: string;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-64 animate-pulse rounded-xl border bg-muted"
          data-testid="skeleton-card"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-medium text-muted-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
    </div>
  );
}

export function ServiceGrid({
  services,
  isLoading,
  emptyMessage = "No services found",
}: ServiceGridProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (services.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {services.map((service) => (
        <ServiceCard
          key={`${service.service_type}-${service.provider_address}`}
          service={service}
        />
      ))}
    </div>
  );
}
