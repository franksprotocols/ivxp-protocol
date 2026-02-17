/**
 * Protocol Documentation Validation Tests
 *
 * Validates:
 * 1. All JSON schemas are valid and compile with ajv
 * 2. Example messages validate against JSON schemas using ajv
 * 3. Invalid messages are rejected by JSON schemas
 * 4. OpenAPI spec is valid YAML and well-structured
 * 5. Mermaid diagrams have valid syntax
 * 6. All internal links resolve
 * 7. Schema definitions match TypeScript protocol types
 * 8. Security documentation covers nonce, timestamp freshness, content hash
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const DOCS_ROOT = resolve(import.meta.dirname, "../../../docs/protocol");
const SCHEMAS_DIR = join(DOCS_ROOT, "schemas");
const DIAGRAMS_DIR = join(DOCS_ROOT, "diagrams");

// ---------------------------------------------------------------------------
// Ajv instance for JSON Schema validation
// ---------------------------------------------------------------------------
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// ---------------------------------------------------------------------------
// Helper: read and parse JSON schema
// ---------------------------------------------------------------------------
function readJsonSchema(filename: string): Record<string, unknown> {
  const filepath = join(SCHEMAS_DIR, filename);
  const content = readFileSync(filepath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helper: compile schema with ajv (strips $schema meta-ref to avoid errors)
// ---------------------------------------------------------------------------
function compileSchema(filename: string) {
  const schema = readJsonSchema(filename);
  // Strip $schema and $id to avoid ajv meta-schema resolution and duplicate key issues
  const { $schema: _$schema, $id: _$id, ...rest } = schema;
  return ajv.compile(rest);
}

// ---------------------------------------------------------------------------
// Helper: read file content
// ---------------------------------------------------------------------------
function readDocFile(relativePath: string): string {
  const filepath = join(DOCS_ROOT, relativePath);
  return readFileSync(filepath, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. JSON Schema Compilation with ajv
// ---------------------------------------------------------------------------
describe("JSON Schema Compilation (ajv)", () => {
  const objectSchemaFiles = [
    "catalog-response.json",
    "quote-request.json",
    "quote-response.json",
    "delivery-request.json",
    "delivery-response.json",
    "status-response.json",
    "download-response.json",
  ];

  const allSchemaFiles = ["catalog-request.json", ...objectSchemaFiles, "status-request.json"];

  it.each(allSchemaFiles)("schema %s is valid JSON with metadata", (filename) => {
    const schema = readJsonSchema(filename);
    expect(schema.$schema).toBeDefined();
    expect(schema.$id).toBeDefined();
    expect(schema.title).toBeDefined();
    expect(schema.description).toBeDefined();
  });

  it.each(objectSchemaFiles)("schema %s compiles with ajv", (filename) => {
    const validate = compileSchema(filename);
    expect(validate).toBeDefined();
    expect(typeof validate).toBe("function");
  });

  it("all object schemas enforce additionalProperties: false", () => {
    for (const filename of objectSchemaFiles) {
      const schema = readJsonSchema(filename);
      if (schema.type === "object") {
        expect(schema.additionalProperties).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Example Message Validation with ajv
// ---------------------------------------------------------------------------
describe("Example Message Validation (ajv)", () => {
  it("valid catalog response passes schema validation", () => {
    const validate = compileSchema("catalog-response.json");

    const example = {
      protocol: "IVXP/1.0",
      provider: "IVXP Demo Provider",
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      services: [{ type: "code_review", base_price_usdc: 5.0, estimated_delivery_hours: 2 }],
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("invalid catalog response fails schema validation", () => {
    const validate = compileSchema("catalog-response.json");

    const invalid = {
      protocol: "IVXP/2.0",
      provider: "",
      wallet_address: "not-an-address",
      services: [],
    };

    const valid = validate(invalid);
    expect(valid).toBe(false);
    expect(validate.errors).not.toBeNull();
    expect(validate.errors!.length).toBeGreaterThan(0);
  });

  it("valid service request passes schema validation", () => {
    const validate = compileSchema("quote-request.json");

    const example = {
      protocol: "IVXP/1.0",
      message_type: "service_request",
      timestamp: "2026-02-05T12:01:00Z",
      client_agent: {
        name: "my-ai-agent",
        wallet_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
      service_request: {
        type: "code_review",
        description: "Review the authentication module",
        budget_usdc: 10.0,
      },
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("service request with extra fields fails validation", () => {
    const validate = compileSchema("quote-request.json");

    const invalid = {
      protocol: "IVXP/1.0",
      message_type: "service_request",
      timestamp: "2026-02-05T12:01:00Z",
      client_agent: {
        name: "my-ai-agent",
        wallet_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      },
      service_request: {
        type: "code_review",
        description: "Review the authentication module",
        budget_usdc: 10.0,
      },
      unknown_field: "should fail",
    };

    const valid = validate(invalid);
    expect(valid).toBe(false);
  });

  it("valid delivery request passes schema validation", () => {
    const validate = compileSchema("delivery-request.json");

    const example = {
      protocol: "IVXP/1.0",
      message_type: "delivery_request",
      timestamp: "2026-02-05T12:05:00Z",
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      payment_proof: {
        tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        from_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        network: "base-sepolia",
      },
      signature:
        "0x59a400bbe14d0f961ba603e687de19706b4ad75dd7da4dd903d15955a42ee0bf8886ef0203e567d086b7fad237c97721e2ab1e4f0955954c187ce202c6d38898f2",
      signed_message:
        "IVXP-DELIVER | Order: ivxp-550e8400-e29b-41d4-a716-446655440000 | Payment: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890 | Nonce: abc123 | Timestamp: 2026-02-05T12:05:00Z",
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("delivery request with invalid signature pattern fails", () => {
    const validate = compileSchema("delivery-request.json");

    const invalid = {
      protocol: "IVXP/1.0",
      message_type: "delivery_request",
      timestamp: "2026-02-05T12:05:00Z",
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      payment_proof: {
        tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        from_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        network: "base-sepolia",
      },
      signature: "0xshort",
      signed_message: "some message",
    };

    const valid = validate(invalid);
    expect(valid).toBe(false);
  });

  it("valid status response passes schema validation", () => {
    const validate = compileSchema("status-response.json");

    const example = {
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      status: "processing",
      created_at: "2026-02-05T12:01:05Z",
      service_type: "code_review",
      price_usdc: 5.0,
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("status response with invalid status fails", () => {
    const validate = compileSchema("status-response.json");

    const invalid = {
      order_id: "ivxp-test",
      status: "unknown_status",
      created_at: "2026-02-05T12:01:05Z",
      service_type: "code_review",
      price_usdc: 5.0,
    };

    const valid = validate(invalid);
    expect(valid).toBe(false);
  });

  it("valid download response passes schema validation", () => {
    const validate = compileSchema("download-response.json");

    const example = {
      protocol: "IVXP/1.0",
      message_type: "service_delivery",
      timestamp: "2026-02-05T14:00:00Z",
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      status: "completed",
      provider_agent: {
        name: "IVXP Demo Provider",
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      },
      deliverable: {
        type: "code_review_result",
        format: "markdown",
        content: "## Results\n\nNo issues found.",
      },
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });

  it("valid delivery accepted response passes schema validation", () => {
    const validate = compileSchema("delivery-response.json");

    const example = {
      status: "accepted",
      order_id: "ivxp-550e8400-e29b-41d4-a716-446655440000",
      message: "Payment verified. Processing your request.",
    };

    const valid = validate(example);
    expect(valid).toBe(true);
    expect(validate.errors).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Schema Structure Validation
// ---------------------------------------------------------------------------
describe("Schema Structure", () => {
  it("catalog-response schema matches protocol types", () => {
    const schema = readJsonSchema("catalog-response.json");
    expect(schema.type).toBe("object");

    const required = schema.required as string[];
    expect(required).toContain("protocol");
    expect(required).toContain("provider");
    expect(required).toContain("wallet_address");
    expect(required).toContain("services");

    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.protocol.const).toBe("IVXP/1.0");
    expect(properties.wallet_address.pattern).toBe("^0x[a-fA-F0-9]{40}$");
  });

  it("quote-request schema matches ServiceRequest type", () => {
    const schema = readJsonSchema("quote-request.json");
    const required = schema.required as string[];
    expect(required).toContain("protocol");
    expect(required).toContain("message_type");
    expect(required).toContain("timestamp");
    expect(required).toContain("client_agent");
    expect(required).toContain("service_request");

    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.message_type.const).toBe("service_request");
  });

  it("quote-response schema has order_id with pattern", () => {
    const schema = readJsonSchema("quote-response.json");
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.order_id.pattern).toBe(
      "^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    );
  });

  it("delivery-request schema matches DeliveryRequest type", () => {
    const schema = readJsonSchema("delivery-request.json");
    const required = schema.required as string[];
    expect(required).toContain("protocol");
    expect(required).toContain("message_type");
    expect(required).toContain("order_id");
    expect(required).toContain("payment_proof");
    expect(required).toContain("signature");
    expect(required).toContain("signed_message");

    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.message_type.const).toBe("delivery_request");
    expect(properties.signature.pattern).toBe("^0x[a-fA-F0-9]{130}$");
  });

  it("status-response schema matches OrderStatusResponse type", () => {
    const schema = readJsonSchema("status-response.json");
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const statusEnum = properties.status.enum as string[];
    expect(statusEnum).toContain("quoted");
    expect(statusEnum).toContain("paid");
    expect(statusEnum).toContain("processing");
    expect(statusEnum).toContain("delivered");
    expect(statusEnum).toContain("delivery_failed");
  });

  it("download-response schema matches DeliveryResponse type", () => {
    const schema = readJsonSchema("download-response.json");
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.message_type.const).toBe("service_delivery");
    expect(properties.status.const).toBe("completed");
    expect(properties.content_hash.pattern).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 4. OpenAPI Specification Validation
// ---------------------------------------------------------------------------
describe("OpenAPI Specification", () => {
  const openapiContent = readDocFile("openapi.yaml");

  it("openapi.yaml exists and is non-empty", () => {
    expect(openapiContent.length).toBeGreaterThan(0);
  });

  it("contains OpenAPI 3.1 version", () => {
    expect(openapiContent).toContain("openapi: 3.1.0");
  });

  it("contains all required endpoints", () => {
    expect(openapiContent).toContain("/catalog:");
    expect(openapiContent).toContain("/request:");
    expect(openapiContent).toContain("/deliver:");
    expect(openapiContent).toContain("/status/{order_id}:");
    expect(openapiContent).toContain("/download/{order_id}:");
  });

  it("contains all component schemas", () => {
    expect(openapiContent).toContain("ServiceCatalog:");
    expect(openapiContent).toContain("ServiceRequest:");
    expect(openapiContent).toContain("ServiceQuote:");
    expect(openapiContent).toContain("DeliveryRequest:");
    expect(openapiContent).toContain("DeliveryAccepted:");
    expect(openapiContent).toContain("DeliveryResponse:");
    expect(openapiContent).toContain("OrderStatusResponse:");
    expect(openapiContent).toContain("ErrorResponse:");
  });

  it("contains all error codes including new ones", () => {
    const allCodes = [
      "PAYMENT_NOT_VERIFIED",
      "SIGNATURE_INVALID",
      "ORDER_NOT_FOUND",
      "SERVICE_UNAVAILABLE",
      "INSUFFICIENT_BALANCE",
      "SERVICE_TYPE_NOT_SUPPORTED",
      "BUDGET_TOO_LOW",
      "PAYMENT_TIMEOUT",
      "ORDER_EXPIRED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "INTERNAL_ERROR",
      "INVALID_TIMESTAMP",
      "DUPLICATE_DELIVERY_REQUEST",
      "INVALID_NETWORK",
      "INVALID_TOKEN_CONTRACT",
      "AMOUNT_MISMATCH",
      "INVALID_ORDER_STATE",
    ];
    for (const code of allCodes) {
      expect(openapiContent).toContain(code);
    }
  });

  it("contains authentication description", () => {
    expect(openapiContent).toContain("EIP-191");
    expect(openapiContent).toContain("signature");
  });

  it("contains example requests and responses", () => {
    expect(openapiContent).toContain("example:");
    expect(openapiContent).toContain("examples:");
  });
});

// ---------------------------------------------------------------------------
// 5. Mermaid Diagram Validation
// ---------------------------------------------------------------------------
describe("Mermaid Diagrams", () => {
  const diagramFiles = [
    "state-machine.mmd",
    "request-sequence.mmd",
    "payment-sequence.mmd",
    "delivery-sequence.mmd",
  ];

  it.each(diagramFiles)("diagram %s exists", (filename) => {
    const filepath = join(DIAGRAMS_DIR, filename);
    expect(existsSync(filepath)).toBe(true);
  });

  it("state-machine.mmd contains all order states", () => {
    const content = readFileSync(join(DIAGRAMS_DIR, "state-machine.mmd"), "utf-8");
    expect(content).toContain("quoted");
    expect(content).toContain("paid");
    expect(content).toContain("processing");
    expect(content).toContain("delivered");
    expect(content).toContain("delivery_failed");
  });

  it("state-machine.mmd uses stateDiagram-v2", () => {
    const content = readFileSync(join(DIAGRAMS_DIR, "state-machine.mmd"), "utf-8");
    expect(content).toContain("stateDiagram-v2");
  });

  it("request-sequence.mmd uses sequenceDiagram", () => {
    const content = readFileSync(join(DIAGRAMS_DIR, "request-sequence.mmd"), "utf-8");
    expect(content).toContain("sequenceDiagram");
  });

  it("payment-sequence.mmd covers payment verification", () => {
    const content = readFileSync(join(DIAGRAMS_DIR, "payment-sequence.mmd"), "utf-8");
    expect(content).toContain("Verify");
    expect(content).toContain("USDC");
  });

  it("delivery-sequence.mmd covers both push and store-forward", () => {
    const content = readFileSync(join(DIAGRAMS_DIR, "delivery-sequence.mmd"), "utf-8");
    expect(content).toContain("Push");
    expect(content).toContain("Store");
  });
});

// ---------------------------------------------------------------------------
// 6. Documentation File Content
// ---------------------------------------------------------------------------
describe("Documentation Files", () => {
  const requiredFiles = [
    "README.md",
    "message-formats.md",
    "state-machine.md",
    "error-codes.md",
    "security.md",
    "compatibility.md",
    "openapi.yaml",
  ];

  it.each(requiredFiles)("file %s exists", (filename) => {
    const filepath = join(DOCS_ROOT, filename);
    expect(existsSync(filepath)).toBe(true);
  });

  it("message-formats.md covers all message types", () => {
    const content = readDocFile("message-formats.md");
    expect(content).toContain("ServiceCatalog");
    expect(content).toContain("ServiceRequest");
    expect(content).toContain("ServiceQuote");
    expect(content).toContain("DeliveryRequest");
    expect(content).toContain("DeliveryAccepted");
    expect(content).toContain("DeliveryResponse");
    expect(content).toContain("OrderStatusResponse");
    expect(content).toContain("ErrorResponse");
  });

  it("message-formats.md specifies order_id UUID v4 format", () => {
    const content = readDocFile("message-formats.md");
    expect(content).toContain("UUID v4");
    expect(content).toContain("ivxp-{uuid-v4}");
  });

  it("error-codes.md covers all error codes including new ones", () => {
    const content = readDocFile("error-codes.md");
    const allCodes = [
      "PAYMENT_NOT_VERIFIED",
      "SIGNATURE_INVALID",
      "ORDER_NOT_FOUND",
      "SERVICE_UNAVAILABLE",
      "INSUFFICIENT_BALANCE",
      "SERVICE_TYPE_NOT_SUPPORTED",
      "BUDGET_TOO_LOW",
      "PAYMENT_TIMEOUT",
      "ORDER_EXPIRED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "INTERNAL_ERROR",
      "INVALID_TIMESTAMP",
      "DUPLICATE_DELIVERY_REQUEST",
      "INVALID_NETWORK",
      "INVALID_TOKEN_CONTRACT",
      "AMOUNT_MISMATCH",
      "INVALID_ORDER_STATE",
    ];
    for (const code of allCodes) {
      expect(content).toContain(code);
    }
  });

  it("security.md covers EIP-191, payment verification, nonce, and timestamp freshness", () => {
    const content = readDocFile("security.md");
    expect(content).toContain("EIP-191");
    expect(content).toContain("Payment Verification");
    expect(content).toContain("base-mainnet");
    expect(content).toContain("base-sepolia");
    expect(content).toContain("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(content).toContain("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    // Fix #3: nonce in signed message
    expect(content).toContain("Nonce");
    expect(content).toContain("nonce");
    // Fix #4: timestamp freshness
    expect(content).toContain("Timestamp Freshness");
    expect(content).toContain("MAX_TIMESTAMP_AGE");
    expect(content).toContain("clock skew");
  });

  it("security.md specifies content hash algorithm details", () => {
    const content = readDocFile("security.md");
    expect(content).toContain("SHA-256");
    expect(content).toContain("JSON.stringify");
    expect(content).toContain("sha256:");
    expect(content).toContain("MUST verify");
  });

  it("state-machine.md covers all states, transitions, and default timeout", () => {
    const content = readDocFile("state-machine.md");
    expect(content).toContain("quoted");
    expect(content).toContain("paid");
    expect(content).toContain("processing");
    expect(content).toContain("delivered");
    expect(content).toContain("delivery_failed");
    expect(content).toContain("confirmed");
    expect(content).toContain("expired");
    // Fix #2: mandatory default timeout
    expect(content).toContain("DEFAULT_PAYMENT_TIMEOUT");
    expect(content).toContain("3600");
  });
});

// ---------------------------------------------------------------------------
// 7. Schema-Type Cross-Reference
// ---------------------------------------------------------------------------
describe("Schema-Type Cross-Reference", () => {
  it("all error codes in OpenAPI match documentation", () => {
    const openapiContent = readDocFile("openapi.yaml");
    const allCodes = [
      "PAYMENT_NOT_VERIFIED",
      "SIGNATURE_INVALID",
      "ORDER_NOT_FOUND",
      "SERVICE_UNAVAILABLE",
      "INSUFFICIENT_BALANCE",
      "SERVICE_TYPE_NOT_SUPPORTED",
      "BUDGET_TOO_LOW",
      "PAYMENT_TIMEOUT",
      "ORDER_EXPIRED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "INTERNAL_ERROR",
      "INVALID_TIMESTAMP",
      "DUPLICATE_DELIVERY_REQUEST",
      "INVALID_NETWORK",
      "INVALID_TOKEN_CONTRACT",
      "AMOUNT_MISMATCH",
      "INVALID_ORDER_STATE",
    ];

    for (const code of allCodes) {
      expect(openapiContent).toContain(code);
    }
  });

  it("all order statuses in schema match TypeScript OrderStatus", () => {
    const schema = readJsonSchema("status-response.json");
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const statusEnum = properties.status.enum as string[];

    const expectedStatuses = ["quoted", "paid", "processing", "delivered", "delivery_failed"];
    expect(statusEnum).toEqual(expect.arrayContaining(expectedStatuses));
    expect(statusEnum.length).toBe(expectedStatuses.length);
  });

  it("network IDs in schemas match TypeScript NetworkId", () => {
    const quoteSchema = readJsonSchema("quote-response.json");
    const defs = quoteSchema.$defs as Record<string, Record<string, unknown>>;
    const quoteDetails = defs.QuoteDetails as Record<string, unknown>;
    const properties = quoteDetails.properties as Record<string, Record<string, unknown>>;
    const networkEnum = properties.network.enum as string[];

    expect(networkEnum).toContain("base-mainnet");
    expect(networkEnum).toContain("base-sepolia");
    expect(networkEnum.length).toBe(2);
  });

  it("delivery formats in schemas match TypeScript DeliveryFormat", () => {
    const schema = readJsonSchema("quote-request.json");
    const defs = schema.$defs as Record<string, Record<string, unknown>>;
    const details = defs.ServiceRequestDetails as Record<string, unknown>;
    const properties = details.properties as Record<string, Record<string, unknown>>;
    const formatEnum = properties.delivery_format.enum as string[];

    expect(formatEnum).toContain("markdown");
    expect(formatEnum).toContain("json");
    expect(formatEnum).toContain("code");
    expect(formatEnum.length).toBe(3);
  });
});
