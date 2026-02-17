import { z } from "zod";

export const searchServicesQuerySchema = z.object({
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
  q: z.string().max(200, "Search query too long").optional(),
  service_type: z.string().optional(),
  min_price: z
    .string()
    .optional()
    .refine((val) => val === undefined || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "min_price must be a non-negative number",
    }),
  max_price: z
    .string()
    .optional()
    .refine((val) => val === undefined || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "max_price must be a non-negative number",
    }),
  provider_id: z.string().optional(),
  sort_by: z.enum(["name", "price", "relevance"]).optional().default("relevance"),
  sort_order: z.enum(["asc", "desc"]).optional().default("asc"),
});

export type SearchServicesQueryInput = z.input<typeof searchServicesQuerySchema>;
export type SearchServicesQueryParsed = z.output<typeof searchServicesQuerySchema>;
