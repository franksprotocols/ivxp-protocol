import type { ServiceDetail as ServiceDetailType } from "@/lib/types/service";
import { ServiceHeader } from "./ServiceHeader";
import { ProviderInfo } from "./ProviderInfo";
import { ServiceSchema } from "./ServiceSchema";
import { ServiceActions } from "./ServiceActions";
import { ProviderRatingsSection } from "@/components/features/rating/ProviderRatingsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceDetailProps {
  readonly service: ServiceDetailType;
}

export function ServiceDetail({ service }: ServiceDetailProps) {
  const description = service.long_description ?? service.description;

  return (
    <div className="space-y-8" data-testid="service-detail">
      <ServiceHeader service={service} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="leading-relaxed text-muted-foreground"
                data-testid="service-description"
              >
                {description}
              </p>
            </CardContent>
          </Card>

          <ServiceSchema inputSchema={service.input_schema} outputSchema={service.output_schema} />

          {service.examples && service.examples.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.examples.map((example) => (
                  <div
                    key={example.description ?? JSON.stringify(example.input)}
                    className="space-y-2 rounded-md border p-4"
                  >
                    {example.description && (
                      <p className="text-sm font-medium">{example.description}</p>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">Input:</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                        <code>{JSON.stringify(example.input, null, 2)}</code>
                      </pre>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Output:</span>
                      <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                        <code>{JSON.stringify(example.output, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ServiceActions service={service} />
          <ProviderInfo service={service} />
          <ProviderRatingsSection providerAddress={service.provider_address} />
        </div>
      </div>
    </div>
  );
}
