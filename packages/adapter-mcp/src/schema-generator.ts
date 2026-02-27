/**
 * SchemaGenerator — converts a Provider ServiceCatalog into MCP Tool Schema
 * definitions so that LLM agents can discover and invoke IVXP services.
 */

import type { ServiceCatalog } from "@ivxp/sdk";
import type { MCPTool } from "./types.js";

/** Derive the service entry type from ServiceCatalog to avoid importing unexported ServiceDefinition. */
type ServiceEntry = ServiceCatalog["services"][number];

export class SchemaGenerator {
  /**
   * Generate an array of MCPTool objects from a ServiceCatalog.
   * Returns one tool per service. Empty catalog returns [].
   */
  static generate(catalog: ServiceCatalog): readonly MCPTool[] {
    const services = catalog.services;
    if (services.length === 0) return [];

    const allServiceTypes = services.map((s) => s.type);
    return services.map((entry) => SchemaGenerator.buildTool(entry, allServiceTypes));
  }

  private static buildTool(entry: ServiceEntry, allServiceTypes: readonly string[]): MCPTool {
    return {
      name: "ivxp_call_service",
      description: SchemaGenerator.buildDescription(entry),
      inputSchema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            description: "Provider URL or DID",
          },
          service: {
            type: "string",
            enum: allServiceTypes,
            description: "Service type from the provider catalog",
          },
          input: {
            type: "object",
            description: "Service-specific input payload",
            additionalProperties: true,
          },
          budget_usdc: {
            type: "number",
            description: "Maximum budget in USDC (e.g. 0.10)",
            minimum: 0,
          },
        },
        required: ["provider", "service", "input", "budget_usdc"],
      },
    };
  }

  private static buildDescription(entry: ServiceEntry): string {
    const parts: string[] = [`Call IVXP service: ${entry.type}`];
    parts.push(`Price: $${entry.base_price_usdc} USDC`);
    return parts.join(" — ");
  }
}
