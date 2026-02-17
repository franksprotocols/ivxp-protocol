/**
 * Stub hook for the IVXP SDK client.
 *
 * Returns a minimal event-emitter-like client interface.
 * Will be replaced with the real SDK client integration later.
 */

export interface DeliverableResponse {
  readonly content: ArrayBuffer;
  readonly contentType: string;
  readonly contentHash: string;
  readonly fileName?: string;
}

export interface IVXPClient {
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
  emit?(event: string, payload: unknown): void;
  downloadDeliverable(orderId: string): Promise<DeliverableResponse>;
}

/**
 * Returns the IVXP SDK client instance, or null if not available.
 * Stub implementation -- returns null until SDK integration is wired up.
 */
export function useIVXPClient(): IVXPClient | null {
  return null;
}
