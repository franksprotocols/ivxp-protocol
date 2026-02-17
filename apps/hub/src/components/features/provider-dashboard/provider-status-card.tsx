"use client";

import type { RegistryProviderWire, VerificationStatus } from "@/lib/registry/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProviderStatusCardProps {
  provider: RegistryProviderWire;
}

const STATUS_BADGE_VARIANT: Record<VerificationStatus, "default" | "destructive" | "secondary"> = {
  verified: "default",
  unresponsive: "destructive",
  pending: "secondary",
};

const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: "Verified",
  unresponsive: "Unresponsive",
  pending: "Pending Verification",
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "Never";
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProviderStatusCard({ provider }: ProviderStatusCardProps) {
  const verificationStatus = provider.verification_status ?? "pending";

  return (
    <div className="space-y-4">
      {verificationStatus === "unresponsive" && (
        <Alert variant="destructive">
          <AlertTitle>Provider Unresponsive</AlertTitle>
          <AlertDescription>
            Your provider endpoint failed health checks. Please verify that your endpoint URL is
            correct and your provider is running at{" "}
            <code className="font-mono text-sm">{provider.endpoint_url}/ivxp/catalog</code>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{provider.name}</CardTitle>
            <Badge variant={STATUS_BADGE_VARIANT[verificationStatus]}>
              {STATUS_LABEL[verificationStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{provider.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Wallet Address</span>
              <p className="font-mono text-muted-foreground">
                {truncateAddress(provider.provider_address)}
              </p>
            </div>
            <div>
              <span className="font-medium">Endpoint URL</span>
              <p className="text-muted-foreground break-all">{provider.endpoint_url}</p>
            </div>
            <div>
              <span className="font-medium">Registered</span>
              <p className="text-muted-foreground">{formatDate(provider.registered_at)}</p>
            </div>
            <div>
              <span className="font-medium">Last Verified</span>
              <p className="text-muted-foreground">
                {formatDate(provider.last_verified_at ?? null)}
              </p>
            </div>
            <div>
              <span className="font-medium">Total Services</span>
              <p className="text-muted-foreground">{provider.services.length}</p>
            </div>
            <div>
              <span className="font-medium">Status</span>
              <p className="text-muted-foreground capitalize">{provider.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
