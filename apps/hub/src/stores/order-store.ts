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
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly txHash?: `0x${string}`;
  readonly blockNumber?: bigint;
  readonly errorMessage?: string;
}

interface OrderStoreState {
  readonly orders: readonly Order[];
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
  readonly getOrder: (orderId: string) => Order | undefined;
  readonly clearOrders: () => void;
}

type OrderStore = OrderStoreState & OrderStoreActions;

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],

  addOrder: (order: Order) => {
    set((state) => ({
      orders: [...state.orders, order],
    }));
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    set((state) => ({
      orders: state.orders.map((o) =>
        o.orderId === orderId ? { ...o, status, updatedAt: new Date() } : o,
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
          updatedAt: new Date(),
        };
      }),
    }));
  },

  getOrder: (orderId: string) => {
    return get().orders.find((o) => o.orderId === orderId);
  },

  clearOrders: () => {
    set({ orders: [] });
  },
}));
