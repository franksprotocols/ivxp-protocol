import { notFound, redirect } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/layouts/docs/page";
import { openApiSource, sdkSource, protocolSource } from "@/lib/source";
import type { Metadata } from "next";
import type { MDXContent } from "mdx/types";
import type { TOCItemType } from "fumadocs-core/toc";

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
    if (slug[1] === "api") {
      const rest = slug.slice(2);
      if (rest.length === 0) {
        return null;
      }

      const page = openApiSource.getPage(rest);
      if (page) return { page, source: openApiSource };
      return null;
    }

    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? ["README"] : rest;
    const page = protocolSource.getPage(pageSlug);
    if (page) return { page, source: protocolSource };
  }

  return null;
}

type ResolvedPageData = {
  title?: string;
  description?: string;
  body: MDXContent;
  toc: TOCItemType[];
};

export default async function DocsPageComponent({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeSlug(slug);

  if (
    normalizedSlug[0] === "protocol" &&
    normalizedSlug[1] === "api" &&
    normalizedSlug.length === 2
  ) {
    redirect("/docs/protocol/api");
  }

  const resolved = resolvePage(normalizedSlug);

  if (!resolved) {
    notFound();
  }

  const { page } = resolved;
  const pageData = page.data as ResolvedPageData;
  const PageContent = pageData.body;

  return (
    <DocsPage toc={pageData.toc}>
      <DocsTitle>{pageData.title}</DocsTitle>
      <DocsDescription>{pageData.description}</DocsDescription>
      <DocsBody>
        <PageContent />
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
  const openApiParams = openApiSource.getPages().map((page) => ({
    slug: ["protocol", "api", ...page.slugs],
  }));
  return [...sdkParams, ...protocolParams, ...openApiParams];
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
