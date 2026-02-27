export interface IVXPMCPAdapterConfig {
  providerUrl: string;
  privateKey: string;
  network: string;
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
