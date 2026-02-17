import type { Metadata } from "next";
import { ProviderRegistrationForm } from "@/components/features/provider-registration-form";

export const metadata: Metadata = {
  title: "Register Provider | IVXP Hub",
  description: "Register your provider on the IVXP Protocol Hub.",
};

export default function ProviderRegisterPage() {
  return (
    <main className="container mx-auto py-10 px-4">
      <ProviderRegistrationForm />
    </main>
  );
}
