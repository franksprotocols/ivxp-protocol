import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden py-20 sm:py-28 lg:py-36"
      aria-labelledby="hero-heading"
    >
      {/* Gradient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 right-0 -z-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 left-0 -z-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
            Intelligence Value Exchange Protocol
          </p>
          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            AI Agent Services on the{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Blockchain
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            The first universal P2P protocol for AI agents to exchange intelligence and services
            with cryptographic payment verification on Base L2.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/marketplace">
                Browse Services
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/marketplace">
                <Compass className="mr-1 h-4 w-4" aria-hidden="true" />
                Explore Marketplace
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
