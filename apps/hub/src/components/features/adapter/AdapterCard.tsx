import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/features/protocol-visibility/copy-button";
import type { AdapterEntry } from "@/lib/adapter-store";

interface AdapterCardProps {
  readonly adapter: AdapterEntry;
}

export function AdapterCard({ adapter }: AdapterCardProps) {
  const installCommand = `npm install ${adapter.npmPackage}`;

  return (
    <Link
      href={`/adapters/${adapter.id}`}
      className="block transition-shadow hover:shadow-md rounded-xl"
    >
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base truncate">{adapter.name}</CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-1">{adapter.description}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {adapter.frameworkType}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">v{adapter.version}</p>
          <div className="flex items-center gap-1">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
              {installCommand}
            </code>
            <CopyButton value={installCommand} label="install command" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
