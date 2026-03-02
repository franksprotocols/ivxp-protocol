import { notFound, redirect } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
  openApiSource,
  protocolSource,
  specificationSource,
  providerSource,
  userSource,
  sdkSource,
} from "@/lib/source";
import { isHiddenDocPage } from "@/lib/docs-visibility";
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

const SECTION_DEFAULT_PAGE_SLUGS = {
  "ivxp-protocol-specification": ["1-what-is-ivxp"],
  protocol: ["integration-profiles"],
  provider: ["quickstart"],
  user: ["quickstart-hub"],
  sdk: ["getting-started", "quick-start-client"],
} as const;

function getSectionDefaultPath(section: keyof typeof SECTION_DEFAULT_PAGE_SLUGS): string {
  return `/docs/${section}/${SECTION_DEFAULT_PAGE_SLUGS[section].join("/")}`;
}

function getRedirectPath(normalizedSlug: string[]): string | null {
  if (normalizedSlug.length === 0) {
    return getSectionDefaultPath("ivxp-protocol-specification");
  }

  const lower = normalizedSlug.map((segment) => segment.toLowerCase());
  const section = lower[0];
  const tail = lower.slice(1);

  if (section === "protocol" && tail[0] === "ivxp-protocol-specification") {
    return getSectionDefaultPath("ivxp-protocol-specification");
  }

  if (section === "protocol" && tail[0] === "api" && lower.length === 2) {
    return "/docs/protocol/api";
  }

  if (
    section === "ivxp-protocol-specification" ||
    section === "protocol" ||
    section === "provider" ||
    section === "user" ||
    section === "sdk"
  ) {
    if (lower.length === 1 || tail[tail.length - 1] === "readme") {
      return getSectionDefaultPath(section);
    }
  }

  return null;
}

function resolvePage(slug: string[] = []) {
  const section = slug[0]?.toLowerCase();

  if (section === "ivxp-protocol-specification") {
    const rest = slug.slice(1);
    const pageSlug =
      rest.length === 0 ? [...SECTION_DEFAULT_PAGE_SLUGS["ivxp-protocol-specification"]] : rest;
    const page = specificationSource.getPage(pageSlug);
    if (page && !isHiddenDocPage(page)) return { page, source: specificationSource };
  }

  if (section === "sdk") {
    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? [...SECTION_DEFAULT_PAGE_SLUGS.sdk] : rest;
    const page = sdkSource.getPage(pageSlug);
    if (page && !isHiddenDocPage(page)) return { page, source: sdkSource };
  }

  if (section === "protocol") {
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
    const pageSlug = rest.length === 0 ? [...SECTION_DEFAULT_PAGE_SLUGS.protocol] : rest;
    const page = protocolSource.getPage(pageSlug);
    if (page && !isHiddenDocPage(page)) return { page, source: protocolSource };
  }

  if (section === "provider") {
    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? [...SECTION_DEFAULT_PAGE_SLUGS.provider] : rest;
    const page = providerSource.getPage(pageSlug);
    if (page && !isHiddenDocPage(page)) return { page, source: providerSource };
  }

  if (section === "user") {
    const rest = slug.slice(1);
    const pageSlug = rest.length === 0 ? [...SECTION_DEFAULT_PAGE_SLUGS.user] : rest;
    const page = userSource.getPage(pageSlug);
    if (page && !isHiddenDocPage(page)) return { page, source: userSource };
  }

  return null;
}

type ResolvedPageData = {
  title?: string;
  description?: string;
  body: MDXContent;
  toc: TOCItemType[];
  full?: boolean;
};

export default async function DocsPageComponent({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = normalizeSlug(slug);

  const redirectPath = getRedirectPath(normalizedSlug);
  if (redirectPath) {
    redirect(redirectPath);
  }

  const resolved = resolvePage(normalizedSlug);

  if (!resolved) {
    notFound();
  }

  const { page } = resolved;
  const pageData = page.data as ResolvedPageData;
  const PageContent = pageData.body;

  return (
    <DocsPage toc={pageData.toc} full={pageData.full}>
      {pageData.full ? null : <DocsTitle>{pageData.title}</DocsTitle>}
      {pageData.full ? null : <DocsDescription>{pageData.description}</DocsDescription>}
      {pageData.full ? (
        <PageContent components={{ ...defaultMdxComponents }} />
      ) : (
        <DocsBody>
          <PageContent components={{ ...defaultMdxComponents }} />
        </DocsBody>
      )}
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const specificationParams = specificationSource
    .getPages()
    .filter((page) => !isHiddenDocPage(page))
    .map((page) => ({
      slug: ["ivxp-protocol-specification", ...page.slugs],
    }));
  const protocolParams = protocolSource
    .getPages()
    .filter((page) => !isHiddenDocPage(page))
    .map((page) => ({
      slug: ["protocol", ...page.slugs],
    }));
  const providerParams = providerSource
    .getPages()
    .filter((page) => !isHiddenDocPage(page))
    .map((page) => ({
      slug: ["provider", ...page.slugs],
    }));
  const userParams = userSource
    .getPages()
    .filter((page) => !isHiddenDocPage(page))
    .map((page) => ({
      slug: ["user", ...page.slugs],
    }));
  const sdkParams = sdkSource
    .getPages()
    .filter((page) => !isHiddenDocPage(page))
    .map((page) => ({
      slug: ["sdk", ...page.slugs],
    }));
  const openApiParams = openApiSource.getPages().map((page) => ({
    slug: ["protocol", "api", ...page.slugs],
  }));
  return [
    ...specificationParams,
    ...protocolParams,
    ...providerParams,
    ...userParams,
    ...sdkParams,
    ...openApiParams,
  ];
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
