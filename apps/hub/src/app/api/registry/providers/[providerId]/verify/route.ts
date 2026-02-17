import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { loadProviders } from "@/lib/registry/loader";
import { verifySingleProvider, applyVerificationResult } from "@/lib/registry/verification-service";
import { updateProviderVerifications } from "@/lib/registry/writer";
import { logError } from "@/lib/logger";
import type {
  RegistryProviderWire,
  VerificationResultWire,
  RegistryErrorResponseWire,
} from "@/lib/registry/types";

interface RouteParams {
  params: Promise<{ providerId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<
  NextResponse<
    | { provider: RegistryProviderWire; verification: VerificationResultWire }
    | RegistryErrorResponseWire
  >
> {
  try {
    const { providerId } = await params;

    const allProviders = loadProviders();
    const provider = allProviders.find((p) => p.provider_id === providerId);

    if (!provider) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_NOT_FOUND",
            message: `Provider with ID '${providerId}' not found.`,
          },
        },
        { status: 404 },
      );
    }

    const result = await verifySingleProvider(provider);
    const updatedProvider = applyVerificationResult(provider, result);

    const updates = new Map<string, Partial<RegistryProviderWire>>();
    updates.set(providerId, {
      verification_status: updatedProvider.verification_status,
      last_verified_at: updatedProvider.last_verified_at,
      last_check_at: updatedProvider.last_check_at,
      consecutive_failures: updatedProvider.consecutive_failures,
      updated_at: updatedProvider.updated_at,
    });
    await updateProviderVerifications(updates);

    return NextResponse.json(
      {
        provider: updatedProvider,
        verification: {
          provider_id: result.providerId,
          provider_address: result.providerAddress,
          name: result.name,
          previous_status: result.previousStatus,
          new_status: result.newStatus,
          reachable: result.reachable,
          response_time_ms: result.responseTimeMs,
          error: result.error,
          error_code: result.errorCode,
          checked_at: result.checkedAt,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logError("Single provider verification failed", error, {
      endpoint: "/api/registry/providers/[providerId]/verify",
    });

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during verification.",
        },
      },
      { status: 500 },
    );
  }
}
