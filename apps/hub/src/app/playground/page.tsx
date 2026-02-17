import type { Metadata } from "next";
import { PlaygroundContent } from "./_components/playground-content";

export const metadata: Metadata = {
  title: "Playground | IVXP Hub",
  description:
    "Test the IVXP protocol with a pre-configured demo Provider and testnet USDC on Base Sepolia.",
};

export default function PlaygroundPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          IVXP Protocol Playground
        </h1>
        <p className="mt-2 text-muted-foreground">
          Test the complete service purchase flow with a demo Provider on
          Base Sepolia testnet.
        </p>
      </div>
      <PlaygroundContent />
    </main>
  );
}
