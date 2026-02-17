import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { searchServicesQuerySchema } from "@/lib/registry/search-schemas";
import { aggregateServices } from "@/lib/registry/service-aggregator";
import { queryServices } from "@/lib/registry/service-search";
import type {
  SearchServicesResponseWire,
  RegistryErrorResponseWire,
} from "@/lib/registry/types";

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<SearchServicesResponseWire | RegistryErrorResponseWire>
> {
  try {
    // 1. Extract query parameters
    const { searchParams } = request.nextUrl;
    const rawParams = Object.fromEntries(searchParams.entries());

    // 2. Validate with Zod
    const query = searchServicesQuerySchema.parse(rawParams);

    // 3. Aggregate services from all verified providers
    const allServices = aggregateServices();

    // 4. Apply search, filters, sorting, pagination
    const { items, total } = queryServices(allServices, query);

    // 5. Return paginated response (snake_case wire format)
    const response: SearchServicesResponseWire = {
      services: items,
      total,
      page: query.page,
      page_size: query.page_size,
      query: query.q,
      filters_applied: {
        service_type: query.service_type,
        min_price: query.min_price,
        max_price: query.max_price,
        provider_id: query.provider_id,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (!details[key]) {
          details[key] = [];
        }
        details[key].push(issue.message);
      }

      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "INVALID_PARAMETERS",
          message: "One or more query parameters are invalid.",
          details,
        },
      };

      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.error("Service search API error:", error);

    const errorResponse: RegistryErrorResponseWire = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
