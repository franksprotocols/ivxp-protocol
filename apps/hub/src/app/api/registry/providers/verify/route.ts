import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadProviders } from "@/lib/registry/loader";
import { verifyAllProviders, applyVerificationResult } from "@/lib/registry/verification-service";
import { updateProviderVerifications } from "@/lib/registry/writer";
import { logError } from "@/lib/logger";
import type {
  VerificationSummaryWire,
  RegistryErrorResponseWire,
  RegistryProviderWire,
} from "@/lib/registry/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerificationSummaryWire | RegistryErrorResponseWire>> {
  try {
    // Optional: Authenticate cron requests via secret header
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("x-cron-secret");
      if (authHeader !== cronSecret) {
        return NextResponse.json(
          {
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid or missing cron secret.",
            },
          },
          { status: 401 },
        );
      }
    }

    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    const allProviders = loadProviders();
    const results = await verifyAllProviders(allProviders);

    // Build update map and apply results
    const updates = new Map<string, Partial<RegistryProviderWire>>();
    for (const result of results) {
      const provider = allProviders.find((p) => p.provider_id === result.providerId);
      if (provider) {
        const updated = applyVerificationResult(provider, result);
        updates.set(result.providerId, {
          verification_status: updated.verification_status,
          last_verified_at: updated.last_verified_at,
          last_check_at: updated.last_check_at,
          consecutive_failures: updated.consecutive_failures,
          updated_at: updated.updated_at,
        });
      }
    }

    if (updates.size > 0) {
      await updateProviderVerifications(updates);
    }

    const completedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - startTime);

    const verifiedCount = results.filter((r) => r.newStatus === "verified").length;
    const unresponsiveCount = results.filter((r) => r.newStatus === "unresponsive").length;
    const gracePeriodCount = results.filter(
      (r) => !r.reachable && r.newStatus !== "unresponsive",
    ).length;

    const summary: VerificationSummaryWire = {
      total_checked: results.length,
      verified_count: verifiedCount,
      unresponsive_count: unresponsiveCount,
      grace_period_count: gracePeriodCount,
      results: results.map((r) => ({
        provider_id: r.providerId,
        provider_address: r.providerAddress,
        name: r.name,
        previous_status: r.previousStatus,
        new_status: r.newStatus,
        reachable: r.reachable,
        response_time_ms: r.responseTimeMs,
        error: r.error,
        error_code: r.errorCode,
        checked_at: r.checkedAt,
      })),
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    logError("Bulk verification failed", error, { endpoint: "/api/registry/providers/verify" });

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
