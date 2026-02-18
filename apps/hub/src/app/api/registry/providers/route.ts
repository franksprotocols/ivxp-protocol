import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { listProvidersQuerySchema, registerProviderBodySchema } from "@/lib/registry/schemas";
import { loadProviders } from "@/lib/registry/loader";
import { queryProviders } from "@/lib/registry/filter";
import {
  verifyRegistrationSignature,
  parseRegistrationMessage,
} from "@/lib/registry/verify-signature";
import { verifyProviderEndpoint } from "@/lib/registry/verify-endpoint";
import { generateProviderId, addProvider } from "@/lib/registry/writer";
import type {
  ListProvidersResponseWire,
  RegisterProviderResponseWire,
  RegistryErrorResponseWire,
  RegistryProviderWire,
} from "@/lib/registry/types";

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
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "INVALID_PARAMETERS",
          message: "One or more query parameters are invalid.",
          details: buildZodErrorDetails(error),
        },
      };

      return NextResponse.json(errorResponse, { status: 400 });
    }

    // eslint-disable-next-line no-console
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

export async function POST(
  request: NextRequest,
): Promise<NextResponse<RegisterProviderResponseWire | RegistryErrorResponseWire>> {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const parsed = registerProviderBodySchema.parse(body);

    // 2. Validate message format and ensure it matches request body
    const parsedMessage = parseRegistrationMessage(parsed.message);
    if (!parsedMessage) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "INVALID_MESSAGE_FORMAT",
          message: "Message does not match the required IVXP Provider Registration format.",
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Ensure message fields match request body
    if (
      parsedMessage.providerAddress.toLowerCase() !== parsed.provider_address.toLowerCase() ||
      parsedMessage.name !== parsed.name ||
      parsedMessage.endpointUrl !== parsed.endpoint_url
    ) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "MESSAGE_MISMATCH",
          message: "Message fields do not match the request body (address, name, or endpoint).",
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 3. Verify EIP-191 signature
    const signatureValid = await verifyRegistrationSignature({
      message: parsed.message,
      signature: parsed.signature as `0x${string}`,
      expectedAddress: parsed.provider_address as `0x${string}`,
    });

    if (!signatureValid) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "SIGNATURE_INVALID",
          message:
            "EIP-191 signature verification failed. The signature does not match the declared provider_address.",
        },
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // 4. Verify provider endpoint is reachable
    const endpointCheck = await verifyProviderEndpoint(parsed.endpoint_url);
    if (!endpointCheck.reachable) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "PROVIDER_UNREACHABLE",
          message: endpointCheck.error ?? "Provider endpoint is not reachable.",
        },
      };
      return NextResponse.json(errorResponse, { status: 422 });
    }

    // 5. Build and persist the new provider entry
    const now = new Date().toISOString();
    const newProvider: RegistryProviderWire = {
      provider_id: generateProviderId(),
      provider_address: parsed.provider_address,
      name: parsed.name,
      description: parsed.description,
      endpoint_url: parsed.endpoint_url,
      services: parsed.services,
      status: "active",
      registered_at: now,
      updated_at: now,
      verification_status: "verified",
      last_verified_at: now,
      last_check_at: now,
      consecutive_failures: 0,
    };

    // addProvider checks for duplicates atomically
    await addProvider(newProvider);

    // 6. Return 201 Created
    const response: RegisterProviderResponseWire = {
      provider: newProvider,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "INVALID_PARAMETERS",
          message: "One or more request body fields are invalid.",
          details: buildZodErrorDetails(error),
        },
      };

      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (error instanceof SyntaxError) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Handle duplicate provider error from addProvider
    if (error instanceof Error && error.message.includes("already exists")) {
      const errorResponse: RegistryErrorResponseWire = {
        error: {
          code: "PROVIDER_ALREADY_REGISTERED",
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    // eslint-disable-next-line no-console
    console.error("[Registry API] POST error:", error);

    const errorResponse: RegistryErrorResponseWire = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
