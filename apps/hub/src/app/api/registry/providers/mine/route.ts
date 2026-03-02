import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { mineProvidersQuerySchema } from "@/lib/registry/schemas";
import { loadProviders } from "@/lib/registry/loader";
import type {
  ListProvidersResponseWire,
  RegistryErrorResponseWire,
  RegistryProviderWire,
} from "@/lib/registry/types";

function buildZodErrorDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!details[key]) {
      details[key] = [];
    }
    details[key].push(issue.message);
  }
  return details;
}

function getClaimTimestamp(provider: RegistryProviderWire): number {
  const claimedAt = provider.claimed_at ? Date.parse(provider.claimed_at) : NaN;
  if (!Number.isNaN(claimedAt)) {
    return claimedAt;
  }

  const registeredAt = Date.parse(provider.registered_at);
  if (!Number.isNaN(registeredAt)) {
    return registeredAt;
  }

  return 0;
}

function isWalletOwnedProvider(provider: RegistryProviderWire, walletAddress: string): boolean {
  const target = walletAddress.toLowerCase();

  if (provider.claimed_by) {
    return provider.claimed_by.toLowerCase() === target;
  }

  // Legacy fallback: only treat provider_address as ownership when the record is claimed.
  const registrationStatus = provider.registration_status ?? "claimed";
  if (registrationStatus !== "claimed") {
    return false;
  }

  return provider.provider_address.toLowerCase() === target;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ListProvidersResponseWire | RegistryErrorResponseWire>> {
  try {
    const rawParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = mineProvidersQuerySchema.parse(rawParams);

    const filtered = loadProviders()
      .filter((provider) => isWalletOwnedProvider(provider, query.wallet_address))
      .filter((provider) => (query.status ? provider.status === query.status : true))
      .filter((provider) => {
        if (!query.registration_status) {
          return true;
        }
        return (provider.registration_status ?? "claimed") === query.registration_status;
      })
      .sort((a, b) => {
        const diff = getClaimTimestamp(b) - getClaimTimestamp(a);
        if (diff !== 0) {
          return diff;
        }
        return a.provider_id.localeCompare(b.provider_id);
      });

    const start = (query.page - 1) * query.page_size;
    const providers = filtered.slice(start, start + query.page_size);

    return NextResponse.json(
      {
        providers,
        total: filtered.length,
        page: query.page,
        page_size: query.page_size,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMETERS",
            message: "One or more query parameters are invalid.",
            details: buildZodErrorDetails(error),
          },
        },
        { status: 400 },
      );
    }

    // eslint-disable-next-line no-console
    console.error("[Registry API] GET /providers/mine error:", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 },
    );
  }
}
