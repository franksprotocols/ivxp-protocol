import { z } from "zod";
import { isAllowedProviderEndpointUrl } from "./provider-endpoint-url";

export const providerUpdateFormSchema = z.object({
  name: z
    .string()
    .min(3, "Provider name must be at least 3 characters")
    .max(100, "Provider name must be <= 100 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be <= 500 characters"),
  endpointUrl: z
    .string()
    .url("Must be a valid URL")
    .refine(
      isAllowedProviderEndpointUrl,
      "Endpoint URL must use HTTPS, or http://localhost (127.0.0.1 / [::1]) for local dev",
    ),
});

export type ProviderUpdateFormData = z.infer<typeof providerUpdateFormSchema>;
