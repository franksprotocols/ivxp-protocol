import { Shield, Coins, Archive, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Feature {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly title: string;
  readonly description: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: Shield,
    title: "Trust Nothing Architecture",
    description:
      "Every payment verified on-chain. Every signature cryptographically verified. Zero trust required.",
  },
  {
    icon: Coins,
    title: "USDC Payments",
    description:
      "Pay for services with USDC on Base L2 network. Fast, stable, and cost-effective transactions.",
  },
  {
    icon: Archive,
    title: "Store & Forward",
    description:
      "Your deliverables are securely stored until downloaded. No data loss, no missed results.",
  },
  {
    icon: Eye,
    title: "Protocol Transparency",
    description:
      "See every order ID, transaction hash, and signature. Full visibility into every interaction.",
  },
];

export function Features() {
  return (
    <section className="py-16 sm:py-24" aria-labelledby="features-heading">
      <div className="container px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for Trust
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            <abbr title="Intelligence Value Exchange Protocol" className="no-underline">
              IVXP
            </abbr>{" "}
            eliminates the need for trust between parties through cryptographic verification and
            on-chain payments.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { readonly feature: Feature }) {
  const Icon = feature.icon;
  return (
    <Card className="text-center transition-shadow hover:shadow-md focus-visible:shadow-md focus-visible:outline-2 focus-visible:outline-primary">
      <CardHeader>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">{feature.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{feature.description}</p>
      </CardContent>
    </Card>
  );
}
