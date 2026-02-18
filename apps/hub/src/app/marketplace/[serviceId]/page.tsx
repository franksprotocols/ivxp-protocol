import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getAllServiceTypes,
  getServiceByType,
  formatServiceName,
  resolveLegacyServiceRoute,
} from "@/lib/api/services";

interface ServiceDetailPageProps {
  readonly params: Promise<{ serviceId: string }>;
}

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const { serviceId } = await params;
  const resolution = resolveLegacyServiceRoute(serviceId);
  const service = getServiceByType(serviceId);

  if (!service || resolution.kind === "none") {
    return { title: "Service Not Found | IVXP Hub" };
  }

  return {
    title: `${formatServiceName(serviceId)} | IVXP Hub`,
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
  const resolution = resolveLegacyServiceRoute(serviceId);

  if (resolution.kind === "none") {
    notFound();
  }

  if (resolution.kind === "unique") {
    redirect(
      `/marketplace/${encodeURIComponent(resolution.providerId)}/${encodeURIComponent(resolution.serviceType)}`,
    );
  }

  redirect(`/marketplace?service_type=${encodeURIComponent(resolution.serviceType)}`);
}
