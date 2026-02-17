"use client";

import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccount } from "wagmi";
import {
  providerRegistrationFormSchema,
  type ProviderRegistrationFormData,
} from "@/lib/provider-registration-schema";
import { useProviderRegistration } from "@/hooks/use-provider-registration";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
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
import { ServiceEntryFields } from "./service-entry-fields";

const DEFAULT_ESTIMATED_TIME_SECONDS = 60;

const DEFAULT_SERVICE = {
  serviceType: "",
  name: "",
  description: "",
  priceUsdc: "",
  estimatedTimeSeconds: DEFAULT_ESTIMATED_TIME_SECONDS,
};

export function ProviderRegistrationForm() {
  const { address, isConnected } = useAccount();
  const { register: registerProvider, state, error, reset } = useProviderRegistration();

  const form = useForm<ProviderRegistrationFormData>({
    // z.coerce.number() produces `unknown` input type in Zod's inference,
    // but the runtime coercion is safe. Cast to the expected Resolver type.
    resolver: zodResolver(providerRegistrationFormSchema) as Resolver<ProviderRegistrationFormData>,
    defaultValues: {
      name: "",
      description: "",
      endpointUrl: "",
      services: [{ ...DEFAULT_SERVICE }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const isSubmitting = state === "signing" || state === "submitting";

  const onSubmit = async (data: ProviderRegistrationFormData) => {
    reset();
    await registerProvider(data);
  };

  if (!isConnected) {
    return (
      <Card className="mx-auto max-w-2xl" data-testid="registration-card">
        <CardHeader>
          <CardTitle>Register Provider</CardTitle>
          <CardDescription>Connect your wallet to register as a provider.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert data-testid="wallet-required-alert">
            <AlertTitle>Wallet Required</AlertTitle>
            <AlertDescription>
              Please connect your wallet to register as a provider. Your wallet address will be used
              as your provider identity.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <ConnectButton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl" data-testid="registration-card">
      <CardHeader>
        <CardTitle>Register Provider</CardTitle>
        <CardDescription>
          Fill in your provider details and sign with your wallet to register.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === "success" && (
          <Alert className="mb-6" data-testid="success-alert" aria-live="polite">
            <AlertTitle>Registration Successful</AlertTitle>
            <AlertDescription>
              Your provider has been registered successfully. Redirecting to dashboard...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert
            variant="destructive"
            className="mb-6"
            data-testid="registration-error"
            aria-live="assertive"
          >
            <AlertTitle>Registration Failed</AlertTitle>
            <AlertDescription>
              <span>{error.message}</span>
              {error.code === "SIGNATURE_REJECTED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    reset();
                    form.handleSubmit(onSubmit)();
                  }}
                  data-testid="retry-button"
                >
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {state === "signing" && (
          <Alert className="mb-6" data-testid="signing-alert" aria-live="polite">
            <AlertTitle>Sign Registration Message</AlertTitle>
            <AlertDescription>
              Please sign the message in your wallet. This is free and requires no gas.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
            data-testid="registration-form"
          >
            {/* Wallet Address (read-only) */}
            <FormItem>
              <FormLabel>Wallet Address</FormLabel>
              <Input
                value={address ?? ""}
                disabled
                className="font-mono"
                data-testid="wallet-address-field"
              />
              <FormDescription>
                Your connected wallet address. This will be your provider identity.
              </FormDescription>
            </FormItem>

            {/* Provider Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My IVXP Provider"
                      {...field}
                      disabled={isSubmitting}
                      data-testid="provider-name-input"
                    />
                  </FormControl>
                  <FormDescription>A display name for your provider (3-100 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your provider and the services you offer..."
                      {...field}
                      disabled={isSubmitting}
                      data-testid="description-input"
                    />
                  </FormControl>
                  <FormDescription>A description of your provider (10-500 chars).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Endpoint URL */}
            <FormField
              control={form.control}
              name="endpointUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://my-provider.example.com"
                      {...field}
                      disabled={isSubmitting}
                      data-testid="endpoint-url-input"
                    />
                  </FormControl>
                  <FormDescription>
                    Your provider&apos;s HTTPS base URL. Must be reachable at /ivxp/catalog.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Services */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Services *</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...DEFAULT_SERVICE })}
                  disabled={isSubmitting || fields.length >= 20}
                  data-testid="add-service-button"
                >
                  Add Service
                </Button>
              </div>
              {fields.map((field, index) => (
                <ServiceEntryFields
                  key={field.id}
                  index={index}
                  control={form.control}
                  onRemove={fields.length > 1 ? () => remove(index) : undefined}
                  disabled={isSubmitting}
                />
              ))}
              {form.formState.errors.services?.message && (
                <p className="text-sm text-destructive" data-testid="services-error">
                  {form.formState.errors.services.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="submit-button"
            >
              {state === "signing"
                ? "Waiting for Signature..."
                : state === "submitting"
                  ? "Registering..."
                  : "Register Provider"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
