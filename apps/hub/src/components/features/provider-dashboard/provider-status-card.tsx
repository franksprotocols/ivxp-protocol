"use client";

import type {
  RegistryProviderWire,
  RegistrationStatus,
  VerificationStatus,
} from "@/lib/registry/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ProviderStatusCardProps {
  provider: RegistryProviderWire;
  onClaim?: () => Promise<boolean>;
  isClaiming?: boolean;
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

const REGISTRATION_LABEL: Record<RegistrationStatus, string> = {
  pending: "Pending Claim",
  claimed: "Claimed",
  revoked: "Revoked",
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProviderStatusCard({ provider, onClaim, isClaiming = false }: ProviderStatusCardProps) {
  const verificationStatus = provider.verification_status ?? "pending";
  const registrationStatus = provider.registration_status ?? "claimed";

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

      {registrationStatus === "pending" && (
        <Alert>
          <AlertTitle>Provider Pending Claim</AlertTitle>
          <AlertDescription>
            This provider was registered without wallet ownership proof. Claim it to make it public.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{provider.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{REGISTRATION_LABEL[registrationStatus]}</Badge>
              <Badge variant={STATUS_BADGE_VARIANT[verificationStatus]}>{STATUS_LABEL[verificationStatus]}</Badge>
            </div>
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
              <p className="break-all text-muted-foreground">{provider.endpoint_url}</p>
            </div>
            <div>
              <span className="font-medium">Registered</span>
              <p className="text-muted-foreground">{formatDate(provider.registered_at)}</p>
            </div>
            <div>
              <span className="font-medium">Claimed At</span>
              <p className="text-muted-foreground">{formatDate(provider.claimed_at)}</p>
            </div>
            <div>
              <span className="font-medium">Total Services</span>
              <p className="text-muted-foreground">{provider.services.length}</p>
            </div>
            <div>
              <span className="font-medium">Status</span>
              <p className="capitalize text-muted-foreground">{provider.status}</p>
            </div>
          </div>

          {registrationStatus === "pending" && onClaim && (
            <Button onClick={() => void onClaim()} disabled={isClaiming}>
              {isClaiming ? "Claiming..." : "Claim Provider"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
