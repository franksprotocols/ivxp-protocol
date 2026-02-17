import { z } from "zod";

const MAX_SERVICES_PER_PROVIDER = 20;

export const listProvidersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform(Number)
    .pipe(z.number().int().min(1, "page must be >= 1")),
  page_size: z
    .string()
    .optional()
    .default("20")
    .transform(Number)
    .pipe(z.number().int().min(1).max(100, "page_size must be <= 100")),
  service_type: z.string().optional(),
  q: z.string().max(200, "Search query too long").optional(),
  sort_by: z.enum(["name", "service_count"]).optional().default("name"),
  sort_order: z.enum(["asc", "desc"]).optional().default("asc"),
  status: z.enum(["active", "inactive"]).optional(),
});

export type ListProvidersQueryInput = z.input<typeof listProvidersQuerySchema>;
export type ListProvidersQueryParsed = z.output<typeof listProvidersQuerySchema>;

const providerServiceSchema = z.object({
  service_type: z
    .string()
    .min(1, "service_type is required")
    .max(50, "service_type must be <= 50 characters")
    .regex(/^[a-z][a-z0-9_]*$/, "service_type must be snake_case"),
  name: z.string().min(1, "name is required").max(100),
  description: z.string().min(1, "description is required").max(500),
  price_usdc: z
    .string()
    .regex(/^\d+\.\d{2}$/, "price_usdc must be a decimal string (e.g., '1.50')")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= 0.01 && num <= 10000.0;
      },
      { message: "price_usdc must be between 0.01 and 10000.00" },
    ),
  estimated_time_seconds: z.number().int().min(1).max(604800),
});

export const registerProviderBodySchema = z.object({
  provider_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  name: z
    .string()
    .min(3, "name must be at least 3 characters")
    .max(100, "name must be <= 100 characters"),
  description: z
    .string()
    .min(10, "description must be at least 10 characters")
    .max(500, "description must be <= 500 characters"),
  endpoint_url: z
    .string()
    .url("endpoint_url must be a valid URL")
    .startsWith("https://", "endpoint_url must use HTTPS"),
  services: z
    .array(providerServiceSchema)
    .min(1, "At least one service is required")
    .max(MAX_SERVICES_PER_PROVIDER, `Maximum ${MAX_SERVICES_PER_PROVIDER} services per provider`)
    .refine(
      (services) => {
        const serviceTypes = services.map((s) => s.service_type);
        return serviceTypes.length === new Set(serviceTypes).size;
      },
      { message: "Duplicate service_type values are not allowed" },
    ),
  signature: z
    .string()
    .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature format (must be 0x + 130 hex chars)"),
  message: z.string().min(1, "Signed message is required"),
});

export type RegisterProviderBodyInput = z.input<typeof registerProviderBodySchema>;
export type RegisterProviderBodyParsed = z.output<typeof registerProviderBodySchema>;
