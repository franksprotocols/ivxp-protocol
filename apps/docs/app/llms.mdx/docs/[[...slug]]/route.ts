import { getLLMText } from "@/lib/get-llm-text";
import {
  openApiSource,
  protocolSource,
  specificationSource,
  providerSource,
  userSource,
  sdkSource,
} from "@/lib/source";
import { notFound } from "next/navigation";

// Cache forever — content only changes on rebuild
export const revalidate = false;

interface RouteContext {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Resolves a slug to the matching page across all doc sources.
 * Mirrors the logic in app/docs/[[...slug]]/page.tsx.
 */
function resolvePage(slug: string[] = []) {
  const section = slug[0]?.toLowerCase();

  if (section === "ivxp-protocol-specification") {
    return specificationSource.getPage(slug.slice(1));
  }
  if (section === "sdk") {
    return sdkSource.getPage(slug.slice(1));
  }
  if (section === "protocol") {
    if (slug[1] === "api") {
      return openApiSource.getPage(slug.slice(2));
    }
    return protocolSource.getPage(slug.slice(1));
  }
  if (section === "provider") {
    return providerSource.getPage(slug.slice(1));
  }
  if (section === "user") {
    return userSource.getPage(slug.slice(1));
  }
  return null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const page = resolvePage(slug);

  if (!page) {
    notFound();
  }

  return new Response(await getLLMText(page), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

export function generateStaticParams() {
  const specificationParams = specificationSource
    .getPages()
    .map((p) => ({ slug: ["ivxp-protocol-specification", ...p.slugs] }));
  const protocolParams = protocolSource.getPages().map((p) => ({ slug: ["protocol", ...p.slugs] }));
  const providerParams = providerSource.getPages().map((p) => ({ slug: ["provider", ...p.slugs] }));
  const userParams = userSource.getPages().map((p) => ({ slug: ["user", ...p.slugs] }));
  const sdkParams = sdkSource.getPages().map((p) => ({ slug: ["sdk", ...p.slugs] }));
  const openApiParams = openApiSource
    .getPages()
    .map((p) => ({ slug: ["protocol", "api", ...p.slugs] }));

  return [
    ...specificationParams,
    ...protocolParams,
    ...providerParams,
    ...userParams,
    ...sdkParams,
    ...openApiParams,
  ];
}
