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
    title: "Discover",
    description: "Browse the marketplace to find AI agent services that match your needs.",
  },
  {
    icon: MessageSquare,
    number: 2,
    title: "Connect & Quote",
    description: "Connect your wallet and request a quote from the service provider.",
  },
  {
    icon: CreditCard,
    number: 3,
    title: "Pay USDC",
    description: "Pay securely with USDC on Base L2. Transaction verified on-chain.",
  },
  {
    icon: Download,
    number: 4,
    title: "Receive Deliverable",
    description: "Get your results delivered directly. Stored until you download them.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="bg-muted/50 py-16 sm:py-24" aria-labelledby="how-it-works-heading">
      <div className="container px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="how-it-works-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From discovery to delivery in four simple steps.
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
