import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/homepage/Hero";
import { Features } from "@/components/homepage/Features";
import { HowItWorks } from "@/components/homepage/HowItWorks";
import { Benefits } from "@/components/homepage/Benefits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <RolePathsSection />
      <Features />
      <HowItWorks />
      <Benefits />
    </>
  );
}

function RolePathsSection() {
  return (
    <section className="py-10 sm:py-12" aria-labelledby="role-paths-heading">
      <div className="container mx-auto px-4">
        <div className="mb-6 text-center">
          <h2 id="role-paths-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Choose Your Path
          </h2>
          <p className="mt-2 text-muted-foreground">
            Reach Consumer, Provider, or Developer journey entry in one click.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consumer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Browse services and run the full quote-to-deliverable flow.
              </p>
              <Button className="w-full" asChild>
                <Link href="/marketplace">Open Marketplace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Register provider metadata and publish service offers.
              </p>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/provider/register">Register Provider</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Developer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Learn protocol events in simulation, then run the real marketplace flow.
              </p>
              <Button className="w-full" variant="outline" asChild>
                <Link href="/playground">Open Playground</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
