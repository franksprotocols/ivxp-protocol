export interface IVXPMCPAdapterConfig {
  providerUrl: string;
  privateKey: string;
  network: string;
}

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}
