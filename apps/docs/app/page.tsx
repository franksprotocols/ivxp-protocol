import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Card, Cards } from "fumadocs-ui/components/card";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";

const HOME_LINKS: LinkItemType[] = [
  { text: "SDK", url: "/docs/sdk" },
  { text: "Protocol", url: "/docs/protocol" },
  { text: "API Reference", url: "/docs/protocol/api" },
];

export default function HomePage() {
  return (
    <HomeLayout
      links={HOME_LINKS}
      githubUrl="https://github.com/ivxp-protocol"
      nav={{ title: "IVXP Docs", url: "/" }}
    >
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-fd-primary/10 via-transparent to-transparent" />
        <div className="container relative mx-auto px-4 py-24 text-center sm:py-28">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-fd-muted-foreground">
            IVXP Documentation
          </p>
          <h1 className="mx-auto mb-4 max-w-3xl text-4xl font-semibold tracking-tight text-fd-foreground sm:text-5xl">
            Build and integrate value-exchanging AI agents.
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base text-fd-muted-foreground sm:text-lg">
            SDK guides, protocol specifications, and generated API reference for IVXP.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/docs/sdk/getting-started/installation"
              className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
            >
              Get Started
            </Link>
            <Link
              href="/docs/protocol/api"
              className="rounded-lg border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              API Reference
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 sm:py-16">
        <Cards className="grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="SDK"
            description="Install the SDK, connect wallets, request quotes, and process delivery."
            href="/docs/sdk"
          >
            Installation, guides, and code examples
          </Card>
          <Card
            title="Protocol"
            description="Understand message formats, state machine, errors, and compatibility rules."
            href="/docs/protocol"
          >
            Wire format and security model
          </Card>
          <Card
            title="API Reference"
            description="Explore generated endpoint docs directly from OpenAPI definitions."
            href="/docs/protocol/api"
          >
            Operation-by-operation reference
          </Card>
        </Cards>
      </section>
    </HomeLayout>
  );
}
