import type { Metadata } from "next";
import { OrderList } from "./_components/order-list";

export const metadata: Metadata = {
  title: "My Orders | IVXP Hub",
  description:
    "Track and manage your IVXP service orders, view order status, and access deliverables.",
};

export default function OrdersPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
        <p className="mt-2 text-muted-foreground">Track and manage your service orders.</p>
      </div>
      <OrderList />
    </main>
  );
}
