import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceDetail } from "@/components/features/service";
import { getServiceByType, getAllServiceTypes, formatServiceName } from "@/lib/api/services";

interface ServiceDetailPageProps {
  readonly params: Promise<{ serviceId: string }>;
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { serviceId } = await params;
  const service = getServiceByType(serviceId);

  if (!service) {
    return { title: "Service Not Found | IVXP Hub" };
  }

  return {
    title: `${formatServiceName(service.service_type)} | IVXP Hub`,
    description: service.description,
  };
}

export function generateStaticParams() {
  return getAllServiceTypes().map((serviceType) => ({
    serviceId: serviceType,
  }));
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const { serviceId } = await params;
  const service = getServiceByType(serviceId);

  if (!service) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <ServiceDetail service={service} />
    </main>
  );
}
