import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Docs | IVXP Hub",
  description: "Quick links for trying IVXP as consumer, provider, or developer.",
};

export default function DocsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Docs & Quick Start</h1>
          <p className="text-muted-foreground">
            Choose a role and jump to the fastest validation path.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consumer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Browse services and run a full purchase flow from quote to verified deliverable.
              </p>
              <Button className="w-full" asChild>
                <Link href="/marketplace">Try Marketplace</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Register your endpoint and publish services to the protocol registry.
              </p>
              <Button className="w-full" asChild>
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
                Learn protocol events in playground, then run the real flow in marketplace.
              </p>
              <Button className="w-full" asChild>
                <Link href="/playground">Open Playground</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reference Docs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <a
              className="block text-primary hover:underline"
              href="https://github.com/franksprotocols/ivxp-protocol/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Repository README
            </a>
            <a
              className="block text-primary hover:underline"
              href="https://github.com/franksprotocols/ivxp-protocol/blob/main/docs/PRD-IVXP-Protocol-v2.0.en.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              IVXP PRD v2.0
            </a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
