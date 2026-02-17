import type { InputSchema, OutputSchema, SchemaProperty } from "@/lib/types/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceSchemaProps {
  readonly inputSchema: InputSchema;
  readonly outputSchema: OutputSchema;
}

function PropertyRow({
  name,
  property,
  isRequired,
}: {
  readonly name: string;
  readonly property: SchemaProperty;
  readonly isRequired: boolean;
}) {
  return (
    <div className="rounded-md border p-3" data-testid={`param-${name}`}>
      <div className="flex items-center gap-2">
        <code className="text-sm font-semibold">{name}</code>
        <Badge variant="outline" className="text-xs">
          {property.type}
        </Badge>
        {isRequired && (
          <Badge variant="destructive" className="text-xs">
            required
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{property.description}</p>
      {property.example != null && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Example: </span>
          <code className="text-xs">{String(property.example)}</code>
        </div>
      )}
    </div>
  );
}

function InputSchemaSection({ schema }: { readonly schema: InputSchema }) {
  const entries = Object.entries(schema.properties);
  const requiredFields = new Set(schema.required ?? []);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No input parameters required.</p>;
  }

  return (
    <div className="space-y-3" data-testid="input-schema">
      {entries.map(([name, property]) => (
        <PropertyRow
          key={name}
          name={name}
          property={property}
          isRequired={requiredFields.has(name)}
        />
      ))}
    </div>
  );
}

function OutputSchemaSection({ schema }: { readonly schema: OutputSchema }) {
  return (
    <div className="space-y-2" data-testid="output-schema">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Type:</span>
        <Badge variant="outline">{schema.type}</Badge>
      </div>
      {schema.format && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Format:</span>
          <code className="text-sm">{schema.format}</code>
        </div>
      )}
      {schema.example && (
        <div>
          <span className="text-sm text-muted-foreground">Example output:</span>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-sm">
            <code>{schema.example}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export function ServiceSchema({ inputSchema, outputSchema }: ServiceSchemaProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Input Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <InputSchemaSection schema={inputSchema} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Output Format</CardTitle>
        </CardHeader>
        <CardContent>
          <OutputSchemaSection schema={outputSchema} />
        </CardContent>
      </Card>
    </div>
  );
}
