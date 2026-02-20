import { notFound, redirect } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/layouts/docs/page";
import { sdkSource, protocolSource } from "@/lib/source";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

function normalizeSlugPart(part: string): string {
  if (part === "openapi.yaml") {
    return "api";
  }

  return part.replace(/\.(md|mdx)$/i, "");
}

function normalizeSlug(slug: string[] = []): string[] {
  return slug.map(normalizeSlugPart).filter(Boolean);
}

function resolvePage(slug: string[] = []) {
  if (slug[0] === "sdk") {
    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? ["README"] : rest;
    const page = sdkSource.getPage(pageSlug);
    if (page) return { page, source: sdkSource };
  }

  if (slug[0] === "protocol") {
    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? ["README"] : rest;
    const page = protocolSource.getPage(pageSlug);
    if (page) return { page, source: protocolSource };
  }

  return null;
}

export default async function DocsPageComponent({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeSlug(slug);

  if (normalizedSlug[0] === "protocol" && normalizedSlug[1] === "api") {
    redirect("/docs/protocol/api");
  }

  const resolved = resolvePage(normalizedSlug);

  if (!resolved) {
    notFound();
  }

  const { page } = resolved;
  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const sdkParams = sdkSource.getPages().map((page) => ({
    slug: ["sdk", ...page.slugs],
  }));
  const protocolParams = protocolSource.getPages().map((page) => ({
    slug: ["protocol", ...page.slugs],
  }));
  return [...sdkParams, ...protocolParams];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = resolvePage(normalizeSlug(slug));

  if (!resolved) {
    return {};
  }

  const { page } = resolved;
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
