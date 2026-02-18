import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About | IVXP Hub",
  description: "Understand IVXP roles and the end-to-end quote to delivery protocol flow.",
};

export default function AboutPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">About IVXP Hub</h1>
          <p className="text-muted-foreground">
            IVXP Hub helps Consumers, Providers, and Developers follow one transparent protocol
            chain: request quote, pay on-chain, sign identity, track status, and download verified
            deliverables.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Protocol Flow Map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Request Quote (`order_id`, `price_usdc`)</p>
            <p>2. Pay USDC (`tx_hash`)</p>
            <p>3. Sign EIP-191 Identity (`signed_message`, `signature`)</p>
            <p>4. Track Provider Status (`status`)</p>
            <p>5. Download Deliverable (`content_hash`)</p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild>
            <Link href="/marketplace">Start as Consumer</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/provider">Start as Provider</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/playground">Start as Developer</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
