export interface IVXPMCPAdapterConfig {
  providerUrl: string;
  privateKey: string;
  network: string;
  /**
   * Optional pre-built IVXPClient instance for dependency injection.
   * When provided, the adapter skips creating its own client in init().
   * Useful for testing with mock crypto/payment services.
   */
  client?: unknown;
  /**
   * When true AND a `client` is injected, skip SSRF checks on handleToolCall
   * provider URLs. Only intended for local integration testing against
   * localhost providers. Has no effect when `client` is not provided.
   */
  dangerouslyDisableSSRF?: boolean;
}

export interface MCPToolInputSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly minimum?: number;
  readonly additionalProperties?: boolean | Record<string, unknown>;
}

export interface MCPToolInputSchema {
  readonly type: "object";
  readonly properties: {
    readonly provider: MCPToolInputSchemaProperty;
    readonly service: MCPToolInputSchemaProperty;
    readonly input: MCPToolInputSchemaProperty;
    readonly budget_usdc: MCPToolInputSchemaProperty;
    readonly [key: string]: MCPToolInputSchemaProperty;
  };
  readonly required: readonly string[];
}

export interface MCPTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: MCPToolInputSchema;
}
