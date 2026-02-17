import { z } from "zod";

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
export type ListProvidersQueryParsed = z.output<
  typeof listProvidersQuerySchema
>;
