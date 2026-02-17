import { z } from "zod";

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
    .startsWith("https://", "Endpoint URL must use HTTPS"),
});

export type ProviderUpdateFormData = z.infer<typeof providerUpdateFormSchema>;
