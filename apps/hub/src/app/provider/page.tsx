import type { Metadata } from "next";
import { ProviderDashboardContent } from "@/components/features/provider-dashboard";

export const metadata: Metadata = {
  title: "Provider Dashboard | IVXP Hub",
  description: "Manage your provider listing on the IVXP Protocol Hub.",
};

export default function ProviderDashboardPage() {
  return (
    <main className="container mx-auto py-10 px-4">
      <ProviderDashboardContent />
    </main>
  );
}
