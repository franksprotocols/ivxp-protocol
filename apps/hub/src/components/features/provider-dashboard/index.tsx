"use client";

import { useProviderDashboard } from "@/hooks/use-provider-dashboard";
import { ProviderStatusCard } from "./provider-status-card";
import { ServiceCatalogSummary } from "./service-catalog-summary";
import { ProviderUpdateForm } from "./provider-update-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export function ProviderDashboardContent() {
  const { provider, state, error, refetch } = useProviderDashboard();

  // Wallet not connected
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
              Please connect your wallet to access your provider dashboard. Your wallet address
              identifies your provider registration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Error state
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

  // Not found state is handled by redirect in the hook
  if (state === "not-found" || !provider) {
    return null;
  }

  // Loaded state - render dashboard
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Provider Dashboard</h1>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <ProviderStatusCard provider={provider} />
          <ServiceCatalogSummary services={provider.services} />
        </TabsContent>

        <TabsContent value="edit" className="mt-6">
          <ProviderUpdateForm provider={provider} onSuccess={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
