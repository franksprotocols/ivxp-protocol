"use client";

import Link from "next/link";
import { useState } from "react";
import { useProviderDashboard } from "@/hooks/use-provider-dashboard";
import { ProviderStatusCard } from "./provider-status-card";
import { ServiceCatalogSummary } from "./service-catalog-summary";
import { ProviderUpdateForm } from "./provider-update-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProviderDashboardContent() {
  const [claimEndpoint, setClaimEndpoint] = useState("");
  const {
    provider,
    providers,
    state,
    error,
    claimError,
    isClaiming,
    selectProvider,
    claimProvider,
    refetch,
  } = useProviderDashboard();

  if (state === "disconnected") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Provider Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Wallet Required</AlertTitle>
            <AlertDescription>
              Please connect your wallet to access your provider dashboard and claim providers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Provider Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Error Loading Dashboard</AlertTitle>
            <AlertDescription>{error ?? "An unexpected error occurred."}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (state === "not-found" || !provider) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>No Providers Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Register or Claim a Provider</AlertTitle>
            <AlertDescription>
              Use skill-first registration, or claim an existing pending provider by endpoint URL.
            </AlertDescription>
          </Alert>

          {claimError && (
            <Alert variant="destructive">
              <AlertTitle>Claim Failed</AlertTitle>
              <AlertDescription>{claimError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Input
              value={claimEndpoint}
              placeholder="https://your-provider.example.com"
              onChange={(event) => setClaimEndpoint(event.target.value)}
            />
            <Button
              disabled={!claimEndpoint.trim() || isClaiming}
              onClick={() => void claimProvider(claimEndpoint.trim())}
            >
              {isClaiming ? "Claiming..." : "Claim by Endpoint"}
            </Button>
          </div>

          <Button variant="outline" asChild>
            <Link href="/provider/skill-register">Open Skill Registration Guide</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isPendingProvider = (provider.registration_status ?? "claimed") === "pending";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Provider Dashboard</h1>

      {claimError && (
        <Alert variant="destructive">
          <AlertTitle>Claim Failed</AlertTitle>
          <AlertDescription>{claimError}</AlertDescription>
        </Alert>
      )}

      {providers.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>My Providers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {providers.map((item) => {
              const active = item.provider_id === provider.provider_id;
              return (
                <Button
                  key={item.provider_id}
                  variant={active ? "default" : "outline"}
                  onClick={() => selectProvider(item.provider_id)}
                >
                  {item.name}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <ProviderStatusCard
            provider={provider}
            isClaiming={isClaiming}
            onClaim={() => claimProvider(provider.endpoint_url)}
          />
          <ServiceCatalogSummary services={provider.services} />
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          {isPendingProvider ? (
            <Alert>
              <AlertTitle>Claim Required</AlertTitle>
              <AlertDescription>
                Claim this provider first before editing metadata.
              </AlertDescription>
            </Alert>
          ) : (
            <ProviderUpdateForm provider={provider} onSuccess={refetch} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
