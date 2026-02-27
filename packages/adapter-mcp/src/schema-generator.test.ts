import { describe, it, expect } from "vitest";
import { SchemaGenerator } from "./schema-generator.js";
import type { ServiceCatalog } from "@ivxp/sdk";

const DUMMY_WALLET = ("0x" + "0".repeat(40)) as `0x${string}`;

const makeCatalog = (types: string[]): ServiceCatalog => ({
  protocol: "IVXP/1.0",
  provider: "test-provider",
  wallet_address: DUMMY_WALLET,
  services: types.map((type) => ({
    type,
    base_price_usdc: 0.05,
    estimated_delivery_hours: 1,
  })),
});

describe("SchemaGenerator.generate", () => {
  it("returns empty array for empty catalog", () => {
    const catalog: ServiceCatalog = {
      protocol: "IVXP/1.0",
      provider: "empty",
      wallet_address: DUMMY_WALLET,
      services: [],
    };
    expect(SchemaGenerator.generate(catalog)).toEqual([]);
  });

  it("returns one MCPTool for single-service catalog", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["summarize"]));
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("ivxp_call_service");
  });

  it("returns one MCPTool per service for multi-service catalog", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["summarize", "translate", "ocr"]));
    expect(tools).toHaveLength(3);
    tools.forEach((tool) => {
      expect(tool.name).toBe("ivxp_call_service");
    });
  });

  it("sets service enum from all catalog service types", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["summarize", "translate"]));
    const serviceEnum = tools[0].inputSchema.properties.service.enum;
    expect(serviceEnum).toEqual(["summarize", "translate"]);
    // Every tool gets the same enum
    expect(tools[1].inputSchema.properties.service.enum).toEqual(["summarize", "translate"]);
  });

  it("requires provider, service, input, budget_usdc", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["ocr"]));
    expect(tools[0].inputSchema.required).toEqual(
      expect.arrayContaining(["provider", "service", "input", "budget_usdc"]),
    );
  });

  it("includes description derived from service type", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["ocr"]));
    expect(tools[0].description).toContain("ocr");
  });

  it("includes price in description when available", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["ocr"]));
    expect(tools[0].description).toContain("$0.05 USDC");
  });

  it("produces valid inputSchema structure", () => {
    const tools = SchemaGenerator.generate(makeCatalog(["code_review"]));
    const schema = tools[0].inputSchema;

    expect(schema.type).toBe("object");
    expect(schema.properties.provider.type).toBe("string");
    expect(schema.properties.service.type).toBe("string");
    expect(schema.properties.input.type).toBe("object");
    expect(schema.properties.input.additionalProperties).toBe(true);
    expect(schema.properties.budget_usdc.type).toBe("number");
    expect(schema.properties.budget_usdc.minimum).toBe(0);
  });
});
