"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  providerUpdateFormSchema,
  type ProviderUpdateFormData,
} from "@/lib/provider-update-schema";
import { useProviderUpdate } from "@/hooks/use-provider-update";
import type { RegistryProviderWire } from "@/lib/registry/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProviderUpdateFormProps {
  provider: RegistryProviderWire;
  onSuccess: () => void;
}

export function ProviderUpdateForm({ provider, onSuccess }: ProviderUpdateFormProps) {
  const { update, state, error, reset } = useProviderUpdate();

  const form = useForm<ProviderUpdateFormData>({
    resolver: zodResolver(providerUpdateFormSchema),
    defaultValues: {
      name: provider.name,
      description: provider.description,
      endpointUrl: provider.endpoint_url,
    },
  });

  const isSubmitting = state === "signing" || state === "submitting";

  const onSubmit = async (data: ProviderUpdateFormData) => {
    reset();
    const updatedProvider = await update(data);
    if (updatedProvider) {
      onSuccess();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Provider</CardTitle>
        <CardDescription>
          Update your provider details. Changes require a new wallet signature.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Update Failed</AlertTitle>
            <AlertDescription>
              {error.message}
              {error.code === "SIGNATURE_REJECTED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    reset();
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {state === "signing" && (
          <Alert className="mb-6">
            <AlertTitle>Sign Update Message</AlertTitle>
            <AlertDescription>
              Please sign the message in your wallet. This is free and requires no gas.
            </AlertDescription>
          </Alert>
        )}

        {state === "success" && (
          <Alert className="mb-6">
            <AlertTitle>Provider Updated</AlertTitle>
            <AlertDescription>
              Your provider details have been updated successfully.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={`space-y-6 ${isSubmitting ? "opacity-60 pointer-events-none" : ""}`}
            aria-busy={isSubmitting}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name *</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>A display name for your provider (3-100 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>A description of your provider (10-500 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endpointUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL *</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>
                    Your provider&apos;s HTTPS base URL. Must be reachable at /ivxp/catalog.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {state === "signing"
                ? "Waiting for Signature..."
                : state === "submitting"
                  ? "Updating..."
                  : "Update Provider"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
