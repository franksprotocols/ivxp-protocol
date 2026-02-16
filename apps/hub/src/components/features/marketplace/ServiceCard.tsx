import { DollarSign } from "lucide-react";
import type { Service } from "@/lib/types/service";
import { truncateAddress } from "@/lib/address";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  readonly service: Service;
  readonly onViewDetails?: (service: Service) => void;
}

function formatServiceName(serviceType: string): string {
  if (!serviceType || serviceType.trim() === "") return "";
  return serviceType
    .split("_")
    .filter((segment) => segment.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ServiceCard({ service, onViewDetails }: ServiceCardProps) {
  const displayName = formatServiceName(service.service_type);
  const providerLabel = service.provider_name ?? truncateAddress(service.provider_address);

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
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!onViewDetails}
          onClick={onViewDetails ? () => onViewDetails(service) : undefined}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
