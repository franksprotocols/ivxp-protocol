const SPEC_ENTRY_PATH = "/docs/ivxp-protocol-specification/1-what-is-ivxp";
const DEFAULT_LOCAL_DOCS_URL = `http://localhost:3001${SPEC_ENTRY_PATH}`;
const DEFAULT_PRODUCTION_DOCS_URL = `https://ivxp-docs.vercel.app${SPEC_ENTRY_PATH}`;

function withSpecEntryPath(urlString: string): string {
  try {
    const url = new URL(urlString);

    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = SPEC_ENTRY_PATH;
    }

    return url.toString();
  } catch {
    return urlString;
  }
}

export function getDocsUrl(env: NodeJS.ProcessEnv): string {
  const configuredUrl = env.NEXT_PUBLIC_DOCS_URL?.trim();

  if (configuredUrl) {
    return withSpecEntryPath(configuredUrl);
  }

  if (env.NODE_ENV === "development") {
    return DEFAULT_LOCAL_DOCS_URL;
  }

  return DEFAULT_PRODUCTION_DOCS_URL;
}

const DEFAULT_DOCS_URL =
  process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_DOCS_URL : DEFAULT_PRODUCTION_DOCS_URL;

export const DOCS_URL = withSpecEntryPath(process.env.NEXT_PUBLIC_DOCS_URL?.trim() || DEFAULT_DOCS_URL);
