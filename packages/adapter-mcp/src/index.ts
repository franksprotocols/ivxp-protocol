// Placeholder stub — full implementation in v3-4-3
import type { IVXPMCPAdapterConfig } from "./types.js";

export class IVXPMCPAdapter {
  constructor(_config: IVXPMCPAdapterConfig) {}
  async init(): Promise<void> {}
  getTools(): unknown[] {
    return [];
  }
  async handleToolCall(_name: string, _args: unknown): Promise<unknown> {
    return {};
  }
}

export type { MCPTool, IVXPMCPAdapterConfig } from "./types.js";
