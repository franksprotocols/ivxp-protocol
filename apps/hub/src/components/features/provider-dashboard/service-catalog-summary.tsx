"use client";

import type { ProviderServiceWire } from "@/lib/registry/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ServiceCatalogSummaryProps {
  services: ProviderServiceWire[];
}

function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function ServiceCatalogSummary({ services }: ServiceCatalogSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Service Catalog</CardTitle>
          <Badge variant="secondary">
            {services.length} service{services.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No services registered. Update your provider to add services.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Price (USDC)</TableHead>
                <TableHead className="text-right">Est. Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.service_type}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {service.service_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {service.description}
                  </TableCell>
                  <TableCell className="text-right font-mono">${service.price_usdc}</TableCell>
                  <TableCell className="text-right">
                    {formatEstimatedTime(service.estimated_time_seconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
