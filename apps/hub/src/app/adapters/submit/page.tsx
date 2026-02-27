import type { Metadata } from "next";
import { AdapterSubmitForm } from "@/components/AdapterSubmitForm";

export const metadata: Metadata = {
  title: "Submit Adapter - IVXP Hub",
  description: "Submit your IVXP adapter for review and publication.",
};

export default function AdapterSubmitPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Submit an Adapter</h1>
        <p className="mt-2 text-muted-foreground">
          Fill in the details below to submit your adapter for review.
        </p>
      </div>
      <AdapterSubmitForm />
    </main>
  );
}
