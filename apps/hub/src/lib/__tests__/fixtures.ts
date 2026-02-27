import type { CreateAdapterInput } from "../adapter-store";

export const VALID_ADAPTER_INPUT: CreateAdapterInput = {
  name: "Test Adapter",
  framework: "MCP SDK",
  version: "1.0.0",
  npmPackage: "@ivxp/adapter-mcp",
  repositoryUrl: "https://github.com/example/adapter-mcp",
  description: "An MCP adapter for IVXP",
  frameworkType: "MCP",
};

export const OPERATOR_SECRET = "test-secret-token";
