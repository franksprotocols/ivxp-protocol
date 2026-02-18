import { create } from "zustand";
import type { Address } from "viem";

export type OrderStatus =
  | "quoted"
  | "paying"
  | "paid"
  | "processing"
  | "delivered"
  | "failed"
  | "delivery_failed";

/** Terminal states where polling should stop. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "failed",
  "delivery_failed",
] as const;

export interface Order {
  readonly orderId: string;
  readonly serviceType: string;
  readonly priceUsdc: string;
  readonly providerAddress: Address;
  readonly providerId?: string;
  readonly providerEndpointUrl?: string;
  readonly clientAddress?: Address;
  readonly status: OrderStatus;
  readonly createdAt: number;
  readonly updatedAt?: number;
  readonly txHash?: `0x${string}`;
  readonly blockNumber?: bigint;
  readonly signedMessage?: string;
  readonly signature?: `0x${string}`;
  /** True when the provider has verified the EIP-191 signature. */
  readonly signatureVerified?: boolean;
  readonly contentHash?: string;
  readonly errorMessage?: string;
}

interface OrderStoreState {
  readonly orders: readonly Order[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

interface OrderStoreActions {
  readonly addOrder: (order: Order) => void;
  readonly updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  readonly updateOrderPayment: (
    orderId: string,
    payment: {
      readonly txHash?: `0x${string}`;
      readonly blockNumber?: bigint;
      readonly status?: OrderStatus;
    },
  ) => void;
  readonly updateOrderSignature: (
    orderId: string,
    fields: {
      readonly signature: `0x${string}`;
      readonly signedMessage: string;
      readonly signatureVerified: boolean;
      readonly status?: OrderStatus;
    },
  ) => void;
  readonly getOrder: (orderId: string) => Order | undefined;
  readonly getOrdersByWallet: (walletAddress: Address) => readonly Order[];
  readonly fetchOrders: (walletAddress: Address) => Promise<void>;
  readonly clearOrders: () => void;
}

type OrderStore = OrderStoreState & OrderStoreActions;

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  addOrder: (order: Order) => {
    set((state) => ({
      orders: [...state.orders, order],
    }));
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId ? { ...o, status, updatedAt: Date.now() } : o,
      ),
    }));
  },

  updateOrderPayment: (orderId, payment) => {
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.orderId !== orderId) return o;

        return {
          ...o,
          ...(payment.txHash !== undefined ? { txHash: payment.txHash } : {}),
          ...(payment.blockNumber !== undefined ? { blockNumber: payment.blockNumber } : {}),
          ...(payment.status !== undefined ? { status: payment.status } : {}),
          updatedAt: Date.now(),
        };
      }),
    }));
  },

  updateOrderSignature: (orderId, fields) => {
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.orderId !== orderId) return o;

        return {
          ...o,
          signature: fields.signature,
          signedMessage: fields.signedMessage,
          signatureVerified: fields.signatureVerified,
          ...(fields.status !== undefined ? { status: fields.status } : {}),
          updatedAt: Date.now(),
        };
      }),
    }));
  },

  getOrder: (orderId: string) => {
    return get().orders.find((o) => o.orderId === orderId);
  },

  getOrdersByWallet: (walletAddress: Address) => {
    const target = walletAddress.toLowerCase();

    return [...get().orders]
      .filter((order) => order.clientAddress?.toLowerCase() === target)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  fetchOrders: async (_walletAddress: Address) => {
    set({ isLoading: true, error: null });
    try {
      // TODO: Call Provider APIs to fetch orders by walletAddress.
      // For now, return the locally cached orders (sorted newest first).
      await new Promise((resolve) => setTimeout(resolve, 100));
      set({ isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch orders";
      set({ isLoading: false, error: message });
    }
  },

  clearOrders: () => {
    set({ orders: [], isLoading: false, error: null });
  },
}));
