import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { ZodError, z } from "zod";
import { claimProviderBodySchema } from "@/lib/registry/schemas";
import { loadProviders } from "@/lib/registry/loader";
import { verifyRegistrationSignature } from "@/lib/registry/verify-signature";
import { claimProviderByEndpoint } from "@/lib/registry/writer";
import type {
  ClaimProviderResponseWire,
  RegistryErrorResponseWire,
  RegistryProviderWire,
} from "@/lib/registry/types";

const CHALLENGE_TIMEOUT_MS = 5000;
const CHALLENGE_PATH = "/.well-known/ivxp-verify";

const challengeResponseSchema = z.object({
  challenge: z.string().min(1),
  signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
});

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

function normalizeEndpointUrl(endpointUrl: string): string {
  try {
    const parsed = new URL(endpointUrl);
    const normalizedPath =
      parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}`;
  } catch {
    return endpointUrl.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function parseClaimMessage(message: string): {
  walletAddress: string;
  endpointUrl: string;
  timestamp: string;
} | null {
  const lines = message.split("\n");
  if (lines.length !== 4 || lines[0] !== "IVXP Provider Claim") {
    return null;
  }

  const walletMatch = lines[1].match(/^Wallet: (.+)$/);
  const endpointMatch = lines[2].match(/^Endpoint: (.+)$/);
  const timestampMatch = lines[3].match(/^Timestamp: (.+)$/);

  if (!walletMatch || !endpointMatch || !timestampMatch) {
    return null;
  }

  return {
    walletAddress: walletMatch[1],
    endpointUrl: endpointMatch[1],
    timestamp: timestampMatch[1],
  };
}

async function verifyClaimChallenge(
  endpointUrl: string,
  walletAddress: string,
): Promise<{
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
}> {
  const challenge = `ivxp-claim:${randomUUID()}`;
  const challengeUrl = `${endpointUrl.replace(/\/$/, "")}${CHALLENGE_PATH}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHALLENGE_TIMEOUT_MS);

    const response = await fetch(challengeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, wallet_address: walletAddress }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        code: "CHALLENGE_HTTP_ERROR",
        message: `Challenge endpoint returned status ${response.status}.`,
      };
    }

    const rawBody = await response.json();
    const parsedBody = challengeResponseSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return {
        ok: false,
        status: 422,
        code: "CHALLENGE_INVALID_RESPONSE",
        message: "Challenge endpoint returned an invalid response payload.",
      };
    }

    const body = parsedBody.data;

    if (body.challenge !== challenge) {
      return {
        ok: false,
        status: 422,
        code: "CHALLENGE_MISMATCH",
        message: "Challenge response did not match the expected challenge.",
      };
    }

    if (body.signer.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        ok: false,
        status: 422,
        code: "CHALLENGE_SIGNER_MISMATCH",
        message: "Challenge signer does not match the claiming wallet.",
      };
    }

    const recoveredAddress = await recoverMessageAddress({
      message: challenge,
      signature: body.signature as `0x${string}`,
    });

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return {
        ok: false,
        status: 422,
        code: "CHALLENGE_SIGNATURE_INVALID",
        message: "Challenge signature could not be verified for the claiming wallet.",
      };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        code: "CHALLENGE_TIMEOUT",
        message: `Challenge endpoint did not respond within ${CHALLENGE_TIMEOUT_MS}ms.`,
      };
    }

    return {
      ok: false,
      status: 503,
      code: "CHALLENGE_REQUEST_FAILED",
      message: `Failed to reach challenge endpoint: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

function findProviderByEndpoint(
  providers: readonly RegistryProviderWire[],
  endpointUrl: string,
): RegistryProviderWire | undefined {
  const target = normalizeEndpointUrl(endpointUrl);
  return providers.find((provider) => normalizeEndpointUrl(provider.endpoint_url) === target);
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ClaimProviderResponseWire | RegistryErrorResponseWire>> {
  try {
    const body = await request.json();
    const parsed = claimProviderBodySchema.parse(body);

    const parsedMessage = parseClaimMessage(parsed.message);
    if (!parsedMessage) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_MESSAGE_FORMAT",
            message: "Message does not match the required IVXP Provider Claim format.",
          },
        },
        { status: 400 },
      );
    }

    if (
      parsedMessage.walletAddress.toLowerCase() !== parsed.wallet_address.toLowerCase() ||
      normalizeEndpointUrl(parsedMessage.endpointUrl) !== normalizeEndpointUrl(parsed.endpoint_url)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "MESSAGE_MISMATCH",
            message: "Message fields do not match the request body (wallet or endpoint).",
          },
        },
        { status: 400 },
      );
    }

    const claimTimestamp = Date.parse(parsedMessage.timestamp);
    if (isNaN(claimTimestamp) || Math.abs(Date.now() - claimTimestamp) > 5 * 60 * 1000) {
      return NextResponse.json(
        {
          error: {
            code: "MESSAGE_EXPIRED",
            message:
              "The claim message has expired or has an invalid timestamp (must be within 5 minutes).",
          },
        },
        { status: 400 },
      );
    }

    const walletProofValid = await verifyRegistrationSignature({
      message: parsed.message,
      signature: parsed.signature as `0x${string}`,
      expectedAddress: parsed.wallet_address as `0x${string}`,
    });

    if (!walletProofValid) {
      return NextResponse.json(
        {
          error: {
            code: "WALLET_PROOF_INVALID",
            message: "Wallet signature verification failed for claim request.",
          },
        },
        { status: 401 },
      );
    }

    const allProviders = loadProviders();
    const targetProvider = findProviderByEndpoint(allProviders, parsed.endpoint_url);

    if (!targetProvider) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_NOT_FOUND",
            message: "No provider was found for the specified endpoint.",
          },
        },
        { status: 404 },
      );
    }

    const registrationStatus = targetProvider.registration_status ?? "claimed";
    if (registrationStatus === "claimed") {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_ALREADY_CLAIMED",
            message: "This provider endpoint has already been claimed.",
          },
        },
        { status: 409 },
      );
    }

    if (registrationStatus === "revoked") {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_REVOKED",
            message: "This provider endpoint has been revoked and cannot be claimed.",
          },
        },
        { status: 409 },
      );
    }

    const challengeResult = await verifyClaimChallenge(parsed.endpoint_url, parsed.wallet_address);
    if (!challengeResult.ok) {
      return NextResponse.json(
        {
          error: {
            code: challengeResult.code ?? "CHALLENGE_FAILED",
            message: challengeResult.message ?? "Challenge verification failed.",
          },
        },
        { status: challengeResult.status ?? 422 },
      );
    }

    const claimedProvider = await claimProviderByEndpoint(
      parsed.endpoint_url,
      parsed.wallet_address,
    );

    return NextResponse.json(
      {
        provider: claimedProvider,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMETERS",
            message: "One or more request body fields are invalid.",
            details: buildZodErrorDetails(error),
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("already claimed")) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_ALREADY_CLAIMED",
            message: error.message,
          },
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_NOT_FOUND",
            message: error.message,
          },
        },
        { status: 404 },
      );
    }

    // eslint-disable-next-line no-console
    console.error("[Registry API] POST /providers/claim error:", error);

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
