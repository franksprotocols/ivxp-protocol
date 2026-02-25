const DEFAULT_LOCAL_DOCS_URL = "http://localhost:3001";
const DEFAULT_PRODUCTION_DOCS_URL = "https://ivxp-docs.vercel.app";

export function getDocsUrl(env: NodeJS.ProcessEnv): string {
  const configuredUrl = env.NEXT_PUBLIC_DOCS_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  if (env.NODE_ENV === "development") {
    return DEFAULT_LOCAL_DOCS_URL;
  }

  return DEFAULT_PRODUCTION_DOCS_URL;
}

const DEFAULT_DOCS_URL =
  process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_DOCS_URL : DEFAULT_PRODUCTION_DOCS_URL;

export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL?.trim() || DEFAULT_DOCS_URL;
