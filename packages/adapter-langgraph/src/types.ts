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
}

export type IVXPLangGraphState = IVXPLangGraphNodeInput & Partial<IVXPLangGraphNodeOutput>;
