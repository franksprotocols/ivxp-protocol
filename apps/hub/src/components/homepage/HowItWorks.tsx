import { Search, MessageSquare, CreditCard, Download } from "lucide-react";

interface Step {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly number: number;
  readonly title: string;
  readonly description: string;
}

const STEPS: readonly Step[] = [
  {
    icon: Search,
    number: 1,
    title: "Request Quote",
    description:
      "Choose a provider and request a quote to get a real order_id and price_usdc response.",
  },
  {
    icon: MessageSquare,
    number: 2,
    title: "Pay + Sign",
    description: "Pay USDC on-chain (tx_hash), then sign EIP-191 identity proof.",
  },
  {
    icon: CreditCard,
    number: 3,
    title: "Track Status",
    description: "Track provider-backed status updates until terminal delivery state.",
  },
  {
    icon: Download,
    number: 4,
    title: "Verify Download",
    description:
      "Download the deliverable and verify content_hash for end-to-end protocol visibility.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="bg-muted/50 py-16 sm:py-24" aria-labelledby="how-it-works-heading">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="how-it-works-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Real purchase chain: quote to pay to sign to status to download.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step }: { readonly step: Step }) {
  const Icon = step.icon;
  return (
    <div
      className="flex flex-col items-center text-center"
      role="group"
      aria-label={`Step ${step.number}: ${step.title}`}
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground ring-2 ring-primary">
          {step.number}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
    </div>
  );
}
