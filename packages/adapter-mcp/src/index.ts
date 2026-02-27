// Placeholder stub — full implementation in v3-4-3
import type { IVXPMCPAdapterConfig, MCPTool } from "./types.js";

export class IVXPMCPAdapter {
  constructor(_config: IVXPMCPAdapterConfig) {}
  async init(): Promise<void> {}
  getTools(): MCPTool[] {
    return [];
  }
  async handleToolCall(_name: string, _args: unknown): Promise<unknown> {
    return {};
  }
}

export { SchemaGenerator } from "./schema-generator.js";
export type {
  MCPTool,
  MCPToolInputSchema,
  MCPToolInputSchemaProperty,
  IVXPMCPAdapterConfig,
} from "./types.js";
