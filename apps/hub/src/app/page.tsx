import type { Metadata } from "next";
import { Hero } from "@/components/homepage/Hero";
import { Features } from "@/components/homepage/Features";
import { HowItWorks } from "@/components/homepage/HowItWorks";
import { Benefits } from "@/components/homepage/Benefits";

export const metadata: Metadata = {
  title: "IVXP Hub - AI Agent Service Marketplace on Blockchain",
  description:
    "Discover and purchase AI agent services with on-chain USDC payments. Built on the IVXP protocol for trust and transparency.",
  keywords: ["AI agents", "blockchain services", "IVXP", "USDC", "Web3", "Base L2"],
  openGraph: {
    title: "IVXP Hub - AI Agent Service Marketplace",
    description: "Trust nothing. Pay on-chain. Get results.",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
    </>
  );
}
