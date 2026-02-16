import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import type { ServiceDetail } from "@/lib/types/service";
import { formatServiceName, formatPrice } from "@/lib/api/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ServiceHeaderProps {
  readonly service: ServiceDetail;
}

export function ServiceHeader({ service }: ServiceHeaderProps) {
  const displayName = formatServiceName(service.service_type);

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketplace" className="hover:text-foreground transition-colors">
          <Button variant="ghost" size="sm" className="gap-1 px-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Marketplace
          </Button>
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{displayName}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {service.category && (
              <Badge variant="secondary" data-testid="service-category">
                {service.category}
              </Badge>
            )}
            {service.tags?.map((tag) => (
              <Badge key={tag} variant="outline" data-testid="service-tag">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <span className="text-2xl font-bold" data-testid="service-price">
            {formatPrice(service.price_usdc)}
          </span>
          {service.estimated_time && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {service.estimated_time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
