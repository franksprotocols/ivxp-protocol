import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateProviderBodySchema } from "@/lib/registry/schemas";
import { loadProviders } from "@/lib/registry/loader";
import { verifyRegistrationSignature } from "@/lib/registry/verify-signature";
import { verifyProviderEndpoint } from "@/lib/registry/verify-endpoint";
import { updateProvider } from "@/lib/registry/writer";
import { logError } from "@/lib/logger";
import type { RegistryProviderWire, RegistryErrorResponseWire } from "@/lib/registry/types";

const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MAX_REQUEST_BODY_BYTES = 10_000; // 10 KB limit for update payloads

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<{ provider: RegistryProviderWire } | RegistryErrorResponseWire>> {
  const { address } = await params;

  if (!ETHEREUM_ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_ADDRESS",
          message: "Invalid Ethereum address format.",
        },
      },
      { status: 400 },
    );
  }

  const allProviders = loadProviders();
  const provider = allProviders.find(
    (p) => p.provider_address.toLowerCase() === address.toLowerCase(),
  );

  if (!provider) {
    return NextResponse.json(
      {
        error: {
          code: "PROVIDER_NOT_FOUND",
          message: "No provider registered with this wallet address.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ provider }, { status: 200 });
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<{ provider: RegistryProviderWire } | RegistryErrorResponseWire>> {
  const { address } = await params;

  if (!ETHEREUM_ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Invalid Ethereum address format." } },
      { status: 400 },
    );
  }

  try {
    // Enforce request body size limit
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body exceeds maximum allowed size.",
          },
        },
        { status: 413 },
      );
    }

    const body = await request.json();
    const validated = updateProviderBodySchema.parse(body);

    // Verify provider exists
    const allProviders = loadProviders();
    const existingProvider = allProviders.find(
      (p) => p.provider_address.toLowerCase() === address.toLowerCase(),
    );

    if (!existingProvider) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_NOT_FOUND",
            message: "No provider registered with this wallet address.",
          },
        },
        { status: 404 },
      );
    }

    // Verify EIP-191 signature
    const isValidSignature = await verifyRegistrationSignature({
      message: validated.message,
      signature: validated.signature as `0x${string}`,
      expectedAddress: address as `0x${string}`,
    });

    if (!isValidSignature) {
      return NextResponse.json(
        { error: { code: "SIGNATURE_INVALID", message: "Signature verification failed." } },
        { status: 401 },
      );
    }

    // Verify endpoint is reachable
    const endpointCheck = await verifyProviderEndpoint(validated.endpoint_url);
    if (!endpointCheck.reachable) {
      return NextResponse.json(
        {
          error: {
            code: "PROVIDER_UNREACHABLE",
            message: "Provider endpoint is not reachable. Please check your URL.",
          },
        },
        { status: 422 },
      );
    }

    // Update provider in registry
    const updatedProvider = await updateProvider(address, {
      name: validated.name,
      description: validated.description,
      endpoint_url: validated.endpoint_url,
    });

    return NextResponse.json({ provider: updatedProvider }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".");
        if (!details[key]) details[key] = [];
        details[key].push(issue.message);
      }
      return NextResponse.json(
        { error: { code: "INVALID_PARAMETERS", message: "Validation failed.", details } },
        { status: 400 },
      );
    }

    logError("[Registry API] PUT /providers/[address] error", error, { address });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 },
    );
  }
}
