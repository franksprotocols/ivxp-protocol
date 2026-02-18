import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceDetail } from "@/components/features/service";
import {
  formatServiceName,
  getCanonicalServiceParams,
  getServiceByProviderAndType,
} from "@/lib/api/services";

interface CanonicalServiceDetailPageProps {
  readonly params: Promise<{ serviceId: string; serviceType: string }>;
}

export async function generateMetadata({
  params,
}: CanonicalServiceDetailPageProps): Promise<Metadata> {
  const { serviceId, serviceType } = await params;
  const service = getServiceByProviderAndType(serviceId, serviceType);

  if (!service) {
    return { title: "Service Not Found | IVXP Hub" };
  }

  return {
    title: `${formatServiceName(service.service_type)} | IVXP Hub`,
    description: service.description,
  };
}

export function generateStaticParams() {
  return getCanonicalServiceParams().map((param) => ({
    serviceId: param.providerId,
    serviceType: param.serviceType,
  }));
}

export default async function CanonicalServiceDetailPage({ params }: CanonicalServiceDetailPageProps) {
  const { serviceId, serviceType } = await params;
  const service = getServiceByProviderAndType(serviceId, serviceType);

  if (!service) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <ServiceDetail service={service} />
    </main>
  );
}
