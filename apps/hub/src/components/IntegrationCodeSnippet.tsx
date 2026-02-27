import type { FrameworkType } from "@/lib/adapter-store";

const SNIPPETS: Record<FrameworkType, string> = {
  A2A: `import { IVXPAdapter } from "{packageName}";

const adapter = new IVXPAdapter({
  providerUrl: "https://provider.example.com",
});
const catalog = await adapter.getCatalog();`,
  LangGraph: `import { IVXPLangGraphAdapter } from "{packageName}";

const adapter = new IVXPLangGraphAdapter({
  providerUrl: "https://provider.example.com",
});`,
  MCP: `import { IVXPMCPAdapter } from "{packageName}";

const adapter = new IVXPMCPAdapter({
  providerUrl: "https://provider.example.com",
});`,
  Other: `import { IVXPAdapter } from "{packageName}";

const adapter = new IVXPAdapter({
  providerUrl: "https://provider.example.com",
});`,
};

interface IntegrationCodeSnippetProps {
  readonly frameworkType: FrameworkType;
  readonly packageName: string;
}

function resolveSnippet(frameworkType: FrameworkType, packageName: string): string {
  const template = SNIPPETS[frameworkType];
  return template.replace(/{packageName}/g, packageName);
}

export function IntegrationCodeSnippet({
  frameworkType,
  packageName,
}: IntegrationCodeSnippetProps) {
  const code = resolveSnippet(frameworkType, packageName);

  return (
    <section aria-labelledby="integration-snippet-heading">
      <h2 id="integration-snippet-heading" className="text-lg font-semibold mb-2">
        Quick Start
      </h2>
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
        <code data-testid="integration-code">{code}</code>
      </pre>
    </section>
  );
}
