import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Community | IVXP Hub",
  description: "Join IVXP testing and feedback loops to improve real protocol usability.",
};

export default function CommunityPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Community</h1>
          <p className="text-muted-foreground">
            Help us improve IVXP Hub clarity and end-to-end usability with real flow feedback.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>How to Participate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Run a complete marketplace flow (quote → pay → sign → status → download).</p>
            <p>2. Report friction points, unclear copy, and missing protocol signals.</p>
            <p>
              3. Share logs/screenshots with `order_id`, `tx_hash`, `status`, and `content_hash`.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <a
                  href="https://github.com/franksprotocols/ivxp-protocol/issues/new/choose"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Submit Issue
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/marketplace">Run Real Flow</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
