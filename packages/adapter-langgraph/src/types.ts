// packages/adapter-langgraph/src/types.ts

export interface IVXPLangGraphNodeInput {
  readonly providerUrl: string;
  readonly serviceType: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly budgetUsdc: number;
}

export interface IVXPLangGraphNodeOutput {
  readonly result: unknown;
  readonly orderId: string;
  readonly contentHash: string;
}

export interface IVXPPollOptions {
  /** Maximum number of polling attempts before timing out. Default: 60. */
  readonly maxAttempts?: number;
  /** Milliseconds between polling attempts. Default: 2000. */
  readonly intervalMs?: number;
}

export interface IVXPLangGraphState extends IVXPLangGraphNodeInput {
  readonly ivxpResult?: IVXPLangGraphNodeOutput;
  readonly ivxpError?: string;
  readonly pollOptions?: IVXPPollOptions;
}
