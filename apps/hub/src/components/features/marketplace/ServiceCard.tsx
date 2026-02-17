import Link from "next/link";
import { DollarSign } from "lucide-react";
import type { Service } from "@/lib/types/service";
import { truncateAddress } from "@/lib/address";
import { formatServiceName } from "@/lib/api/services";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  readonly service: Service;
  readonly onViewDetails?: (service: Service) => void;
}

export function ServiceCard({ service, onViewDetails }: ServiceCardProps) {
  const displayName = formatServiceName(service.service_type);
  const providerLabel = service.provider_name ?? truncateAddress(service.provider_address);
  const detailHref = `/marketplace/${service.service_type}`;

  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{displayName}</CardTitle>
          {service.category && (
            <Badge variant="secondary" data-testid="service-category">
              {service.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1 text-sm font-medium">
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            <span>{service.price_usdc} USDC</span>
          </div>
          <span className="text-xs text-muted-foreground" title={service.provider_address}>
            {providerLabel}
          </span>
        </div>
        {onViewDetails ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onViewDetails(service)}
          >
            View Details
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={detailHref}>View Details</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
