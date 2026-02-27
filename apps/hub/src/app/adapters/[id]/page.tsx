import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getAdapter } from "@/lib/adapter-store";
import { FrameworkTypeBadge } from "@/components/features/adapter/FrameworkTypeBadge";
import { IntegrationCodeSnippet } from "@/components/IntegrationCodeSnippet";
import { CopyButton } from "@/components/features/protocol-visibility/copy-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const adapter = getAdapter(id);

  if (!adapter || adapter.status !== "published") {
    return { title: "Adapter Not Found - IVXP Hub" };
  }

  return {
    title: `${adapter.name} - IVXP Hub`,
    description: adapter.description,
  };
}

export default async function AdapterDetailPage({ params }: PageProps) {
  const { id } = await params;
  const adapter = getAdapter(id);

  if (!adapter || adapter.status !== "published") {
    notFound();
  }

  const installCommand = `npm install ${adapter.npmPackage}`;
  const npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(adapter.npmPackage)}`;
  const safeRepositoryUrl = isSafeUrl(adapter.repositoryUrl) ? adapter.repositoryUrl : null;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/adapters" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to Adapters
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{adapter.name}</h1>
        <FrameworkTypeBadge type={adapter.frameworkType} />
        <span className="text-sm text-muted-foreground">v{adapter.version}</span>
      </div>

      <p className="text-muted-foreground mb-6">{adapter.description}</p>

      <section aria-labelledby="install-heading" className="mb-8">
        <h2 id="install-heading" className="text-lg font-semibold mb-2">
          Installation
        </h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted px-4 py-2 text-sm">{installCommand}</code>
          <CopyButton value={installCommand} label="install command" />
        </div>
      </section>

      <div className="mb-8">
        <IntegrationCodeSnippet
          frameworkType={adapter.frameworkType}
          packageName={adapter.npmPackage}
        />
      </div>

      <section aria-labelledby="links-heading" className="mb-8">
        <h2 id="links-heading" className="text-lg font-semibold mb-2">
          Links
        </h2>
        <ul className="flex gap-4">
          <li>
            <a
              href={npmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              npm
            </a>
          </li>
          {safeRepositoryUrl !== null && (
            <li>
              <a
                href={safeRepositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                GitHub
              </a>
            </li>
          )}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        This {adapter.frameworkType} adapter is part of the IVXP ecosystem.
      </p>
    </main>
  );
}
