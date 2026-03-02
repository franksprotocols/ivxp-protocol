import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { Card, Cards } from "fumadocs-ui/components/card";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";

const HOME_LINKS: LinkItemType[] = [
  {
    text: "IVXP Protocol Specification",
    url: "/docs/ivxp-protocol-specification/1-what-is-ivxp",
  },
  { text: "Protocol", url: "/docs/protocol/integration-profiles" },
  { text: "Provider", url: "/docs/provider" },
  { text: "Service User", url: "/docs/user" },
  { text: "SDK", url: "/docs/sdk" },
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
            Protocol first. Then provider integration and service consumption.
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base text-fd-muted-foreground sm:text-lg">
            Start from the IVXP specification, then follow role-based guides for providers and
            service users.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/docs/ivxp-protocol-specification/1-what-is-ivxp"
              className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
            >
              Read Specification
            </Link>
            <Link
              href="/docs/provider"
              className="rounded-lg border bg-fd-card px-4 py-2 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              I am a Provider
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 sm:py-16">
        <Cards className="grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card
            title="IVXP Protocol Specification"
            description="Read the standard first: message formats, security model, state machine, and compatibility."
            href="/docs/ivxp-protocol-specification/1-what-is-ivxp"
          >
            Source of truth for IVXP behavior
          </Card>
          <Card
            title="Protocol References"
            description="Integration profiles, compatibility rules, schemas, and security deep dives."
            href="/docs/protocol/integration-profiles"
          >
            Supporting references around the core spec
          </Card>
          <Card
            title="Provider"
            description="Implement provider endpoints, payment verification, delivery flow, and conformance checks."
            href="/docs/provider"
          >
            Integration path for service providers
          </Card>
          <Card
            title="Service User"
            description="Connect wallet, purchase services, inspect orders, and verify deliverables safely."
            href="/docs/user"
          >
            Task-based guide for service consumers
          </Card>
          <Card
            title="SDK"
            description="Install the SDK, connect wallets, request quotes, and process delivery."
            href="/docs/sdk"
          >
            Installation, guides, and code examples
          </Card>
          <Card
            title="API Reference"
            description="Browse generated endpoint documentation from OpenAPI."
            href="/docs/protocol/api"
          >
            Operation-by-operation schema details
          </Card>
        </Cards>
      </section>
    </HomeLayout>
  );
}
