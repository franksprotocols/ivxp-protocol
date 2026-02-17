import type { RegistryProviderWire, VerificationResult, VerificationStatus } from "./types";

// Default constants with environment variable overrides
const VERIFICATION_TIMEOUT_MS = parseInt(process.env.VERIFICATION_TIMEOUT_MS || "5000", 10) || 5000;
const GRACE_PERIOD_FAILURES = parseInt(process.env.GRACE_PERIOD_FAILURES || "3", 10) || 3;

/**
 * Error categories for verification failures
 */
export enum VerificationErrorCode {
  TIMEOUT = "TIMEOUT",
  HTTP_ERROR = "HTTP_ERROR",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  NETWORK_ERROR = "NETWORK_ERROR",
  DNS_ERROR = "DNS_ERROR",
  SSL_ERROR = "SSL_ERROR",
  UNKNOWN = "UNKNOWN",
}

/**
 * Categorize error based on error message and type
 */
function categorizeError(err: unknown, statusCode?: number): VerificationErrorCode {
  if (err instanceof DOMException && err.name === "AbortError") {
    return VerificationErrorCode.TIMEOUT;
  }

  if (statusCode !== undefined) {
    return VerificationErrorCode.HTTP_ERROR;
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("enotfound") || message.includes("dns")) {
      return VerificationErrorCode.DNS_ERROR;
    }
    if (message.includes("certificate") || message.includes("ssl") || message.includes("tls")) {
      return VerificationErrorCode.SSL_ERROR;
    }
    if (
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("network")
    ) {
      return VerificationErrorCode.NETWORK_ERROR;
    }
  }

  return VerificationErrorCode.UNKNOWN;
}

/**
 * Configuration for the verification service.
 * Uses injectable fetch for testability.
 */
export interface VerificationConfig {
  timeoutMs?: number;
  gracePeriodFailures?: number;
  fetchFn?: typeof fetch;
}

const defaultConfig: Required<VerificationConfig> = {
  timeoutMs: VERIFICATION_TIMEOUT_MS,
  gracePeriodFailures: GRACE_PERIOD_FAILURES,
  fetchFn: fetch,
};

/**
 * Verify a single provider by checking its /ivxp/catalog endpoint.
 * Returns a VerificationResult with the new status and metadata.
 */
export async function verifySingleProvider(
  provider: RegistryProviderWire,
  config: VerificationConfig = {},
): Promise<VerificationResult> {
  const { timeoutMs, gracePeriodFailures, fetchFn } = {
    ...defaultConfig,
    ...config,
  };

  const checkedAt = new Date().toISOString();
  const catalogUrl = `${provider.endpoint_url.replace(/\/$/, "")}/ivxp/catalog`;
  const previousStatus = provider.verification_status;

  let reachable = false;
  let responseTimeMs: number | null = null;
  let error: string | null = null;
  let errorCode: string | null = null;
  let httpStatus: number | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = performance.now();

    const response = await fetchFn(catalogUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    responseTimeMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      httpStatus = response.status;
      error = `Provider returned status ${response.status} from ${catalogUrl}`;
      errorCode = categorizeError(null, httpStatus);
    } else {
      const body = await response.json();
      if (!body || !Array.isArray(body.services)) {
        error = "Response body missing required 'services' array";
        errorCode = VerificationErrorCode.INVALID_RESPONSE;
      } else {
        reachable = true;
      }
    }
  } catch (err) {
    errorCode = categorizeError(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      error = `Provider did not respond within ${timeoutMs}ms`;
    } else {
      error = `Failed to reach provider at ${catalogUrl}: ${
        err instanceof Error ? err.message : "Unknown error"
      }`;
    }
  }

  const newStatus = determineNewStatus({
    reachable,
    previousStatus,
    consecutiveFailures: provider.consecutive_failures,
    gracePeriodFailures,
  });

  return {
    providerId: provider.provider_id,
    providerAddress: provider.provider_address,
    name: provider.name,
    previousStatus,
    newStatus,
    reachable,
    responseTimeMs,
    error,
    errorCode,
    checkedAt,
  };
}

/**
 * Validate verification status transition parameters.
 * @throws Error if parameters are invalid
 */
export function validateStatusTransition(params: {
  reachable: boolean;
  previousStatus: VerificationStatus;
  consecutiveFailures: number;
  gracePeriodFailures: number;
}): void {
  const {
    reachable: _reachable,
    previousStatus,
    consecutiveFailures,
    gracePeriodFailures,
  } = params;

  // Validate previousStatus is a valid enum value
  const validStatuses: VerificationStatus[] = ["verified", "unresponsive", "pending"];
  if (!validStatuses.includes(previousStatus)) {
    throw new Error(`Invalid previousStatus: ${previousStatus}`);
  }

  // Validate consecutiveFailures is non-negative
  if (consecutiveFailures < 0 || !Number.isInteger(consecutiveFailures)) {
    throw new Error(
      `consecutiveFailures must be a non-negative integer, got: ${consecutiveFailures}`,
    );
  }

  // Validate gracePeriodFailures is positive
  if (gracePeriodFailures < 1 || !Number.isInteger(gracePeriodFailures)) {
    throw new Error(`gracePeriodFailures must be a positive integer, got: ${gracePeriodFailures}`);
  }

  // Note: We don't validate state consistency between previousStatus and consecutiveFailures
  // because during verification, we may have intermediate states like:
  // - previousStatus="verified" with consecutiveFailures=1 (first failure, still in grace period)
  // - previousStatus="verified" with consecutiveFailures=2 (second failure, still in grace period)
  // These are valid states during the transition process.
}

/**
 * Determine the new verification status based on the check result
 * and the grace period logic.
 */
export function determineNewStatus(params: {
  reachable: boolean;
  previousStatus: VerificationStatus;
  consecutiveFailures: number;
  gracePeriodFailures: number;
}): VerificationStatus {
  // Validate inputs before processing
  validateStatusTransition(params);

  const { reachable, previousStatus, consecutiveFailures, gracePeriodFailures } = params;

  if (reachable) {
    return "verified";
  }

  // Failed check: consecutiveFailures is the count BEFORE this failure,
  // so we add 1 to represent the current failure
  const newFailureCount = consecutiveFailures + 1;

  if (newFailureCount >= gracePeriodFailures) {
    return "unresponsive";
  }

  // Within grace period: keep previous status
  return previousStatus;
}

/**
 * Verify all active providers in parallel using Promise.allSettled.
 * Returns results for every provider regardless of individual failures.
 */
export async function verifyAllProviders(
  providers: RegistryProviderWire[],
  config: VerificationConfig = {},
): Promise<VerificationResult[]> {
  const activeProviders = providers.filter((p) => p.status === "active");

  const results = await Promise.allSettled(
    activeProviders.map((provider) => verifySingleProvider(provider, config)),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    // Defensive fallback for unexpected rejections
    const provider = activeProviders[index];
    return {
      providerId: provider.provider_id,
      providerAddress: provider.provider_address,
      name: provider.name,
      previousStatus: provider.verification_status,
      newStatus: provider.verification_status,
      reachable: false,
      responseTimeMs: null,
      error: `Unexpected verification error: ${
        result.reason instanceof Error ? result.reason.message : "Unknown"
      }`,
      errorCode: VerificationErrorCode.UNKNOWN,
      checkedAt: new Date().toISOString(),
    };
  });
}

/**
 * Apply a verification result to a provider record, returning the updated provider.
 * This is a pure function - it does NOT mutate the input.
 */
export function applyVerificationResult(
  provider: RegistryProviderWire,
  result: VerificationResult,
): RegistryProviderWire {
  return {
    ...provider,
    verification_status: result.newStatus,
    last_check_at: result.checkedAt,
    last_verified_at: result.reachable ? result.checkedAt : provider.last_verified_at,
    consecutive_failures: result.reachable ? 0 : provider.consecutive_failures + 1,
    updated_at: result.checkedAt,
  };
}
