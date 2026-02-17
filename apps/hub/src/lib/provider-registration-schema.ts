import { z } from "zod";

const serviceEntrySchema = z.object({
  serviceType: z
    .string()
    .min(1, "Service type is required")
    .max(50, "Service type must be <= 50 characters")
    .regex(/^[a-z][a-z0-9_]*$/, "Service type must be snake_case (e.g., text_echo)"),
  name: z.string().min(1, "Service name is required").max(100),
  description: z.string().min(1, "Service description is required").max(500),
  priceUsdc: z.string().regex(/^\d+\.\d{2}$/, "Price must be a decimal (e.g., '1.50')"),
  estimatedTimeSeconds: z.coerce
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1 second")
    .max(604800, "Must be <= 7 days"),
});

export const providerRegistrationFormSchema = z.object({
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
  services: z
    .array(serviceEntrySchema)
    .min(1, "At least one service is required")
    .max(20, "Maximum 20 services per provider"),
});

export type ProviderRegistrationFormData = z.infer<typeof providerRegistrationFormSchema>;
export type ServiceEntryFormData = z.infer<typeof serviceEntrySchema>;
