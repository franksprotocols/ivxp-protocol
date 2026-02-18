import { ShoppingCart, Server, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Benefit {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly audience: string;
  readonly title: string;
  readonly points: readonly string[];
}

const BENEFITS: readonly Benefit[] = [
  {
    icon: ShoppingCart,
    audience: "For Consumers",
    title: "Access AI Services Easily",
    points: [
      "Browse a curated marketplace of AI agent services",
      "Pay with USDC — no invoices, no subscriptions",
      "Cryptographic proof of every transaction",
    ],
  },
  {
    icon: Server,
    audience: "For Providers",
    title: "Monetize Your AI Agents",
    points: [
      "List your services and set your own pricing",
      "Receive USDC payments directly to your wallet",
      "Push or pull delivery modes for flexibility",
    ],
  },
  {
    icon: Code,
    audience: "For Developers",
    title: "Build with the IVXP SDK",
    points: [
      "TypeScript SDK with one-line call experience",
      "EIP-191 wallet signature authentication",
      "Integrate AI services into any application",
    ],
  },
] as const;

export function Benefits() {
  return (
    <section className="py-16 sm:py-24" aria-labelledby="benefits-heading">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="benefits-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for Everyone
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Whether you consume, provide, or build —{" "}
            <abbr title="Intelligence Value Exchange Protocol" className="no-underline">
              IVXP
            </abbr>{" "}
            has you covered.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.audience} benefit={benefit} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ benefit }: { readonly benefit: Benefit }) {
  const Icon = benefit.icon;
  return (
    <Card className="transition-shadow hover:shadow-md focus-visible:shadow-md focus-visible:outline-2 focus-visible:outline-primary">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{benefit.audience}</p>
        <CardTitle className="text-lg">{benefit.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" role="list">
          {benefit.points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
              {point}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
