import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { listProvidersQuerySchema } from "@/lib/registry/schemas";
import { loadProviders } from "@/lib/registry/loader";
import { queryProviders } from "@/lib/registry/filter";
import type { ListProvidersResponseWire, RegistryErrorResponseWire } from "@/lib/registry/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ListProvidersResponseWire | RegistryErrorResponseWire>> {
  try {
    const { searchParams } = request.nextUrl;
    const rawParams = Object.fromEntries(searchParams.entries());

    const query = listProvidersQuerySchema.parse(rawParams);

    const allProviders = loadProviders();

    const { items, total } = queryProviders(allProviders, query);

    const response: ListProvidersResponseWire = {
      providers: items,
      total,
      page: query.page,
      page_size: query.page_size,
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

    console.error("[Registry API] Unexpected error:", error);

    const errorResponse: RegistryErrorResponseWire = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
