import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-fd-card/40">
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-fd-foreground sm:text-5xl">
            IVXP Documentation
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-fd-muted-foreground">
            Intelligence Value Exchange Protocol — SDK guides, wire format reference, and full API
            documentation.
          </p>
        </div>
      </div>

      {/* Entry cards */}
      <div className="container mx-auto grid gap-6 px-6 py-16 sm:grid-cols-3">
        <Link
          href="/docs/sdk"
          className="group rounded-xl border bg-fd-card p-6 shadow-sm transition-all hover:border-fd-primary/60 hover:shadow-md"
        >
          <div className="mb-3 text-2xl">📦</div>
          <h2 className="mb-2 text-xl font-semibold text-fd-foreground group-hover:text-fd-primary">
            SDK
          </h2>
          <p className="text-sm text-fd-muted-foreground">
            Build AI agents that pay and get paid. Installation, guides, and end-to-end examples.
          </p>
        </Link>

        <Link
          href="/docs/protocol"
          className="group rounded-xl border bg-fd-card p-6 shadow-sm transition-all hover:border-fd-primary/60 hover:shadow-md"
        >
          <div className="mb-3 text-2xl">📡</div>
          <h2 className="mb-2 text-xl font-semibold text-fd-foreground group-hover:text-fd-primary">
            Protocol
          </h2>
          <p className="text-sm text-fd-muted-foreground">
            Understand the wire format, state machine, security model, and error codes.
          </p>
        </Link>

        <Link
          href="/docs/protocol/api"
          className="group rounded-xl border bg-fd-card p-6 shadow-sm transition-all hover:border-fd-primary/60 hover:shadow-md"
        >
          <div className="mb-3 text-2xl">🔌</div>
          <h2 className="mb-2 text-xl font-semibold text-fd-foreground group-hover:text-fd-primary">
            API Reference
          </h2>
          <p className="text-sm text-fd-muted-foreground">
            Browse all endpoints and message schemas from the OpenAPI specification.
          </p>
        </Link>
      </div>
    </main>
  );
}
