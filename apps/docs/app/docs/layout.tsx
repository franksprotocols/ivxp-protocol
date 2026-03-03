import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Item, Node, Root } from "fumadocs-core/page-tree";
import {
  openApiSource,
  protocolSource,
  specificationSource,
  providerSource,
  userSource,
  sdkSource,
} from "@/lib/source";
import { isHiddenDocUrl } from "@/lib/docs-visibility";

function findFirstPageItem(nodes: Node[]): Item | undefined {
  for (const node of nodes) {
    if (node.type === "page") {
      return node;
    }

    if (node.type === "folder") {
      const nested = node.index ?? findFirstPageItem(node.children);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function pruneHiddenNodes(nodes: Node[]): Node[] {
  const visibleNodes: Node[] = [];

  for (const node of nodes) {
    if (node.type === "page") {
      if (!isHiddenDocUrl(node.url)) {
        visibleNodes.push(node);
      }
      continue;
    }

    if (node.type === "folder") {
      const children = pruneHiddenNodes(node.children);
      const index =
        node.index && !isHiddenDocUrl(node.index.url) ? node.index : findFirstPageItem(children);

      if (children.length > 0 || index) {
        visibleNodes.push({
          ...node,
          index,
          children,
        });
      }

      continue;
    }

    visibleNodes.push(node);
  }

  return visibleNodes;
}

function sanitizeTree(tree: Root): Root {
  return {
    ...tree,
    children: pruneHiddenNodes(tree.children),
  };
}

function mergeProtocolTree(protocolTree: Root, openApiTree: Root): Root {
  if (openApiTree.children.length === 0) {
    return protocolTree;
  }

  return {
    ...protocolTree,
    children: [
      ...protocolTree.children,
      {
        type: "folder",
        name: "API Reference",
        children: openApiTree.children,
      },
    ],
  };
}

function createSection(name: string, tree: Root): Node {
  return {
    type: "folder",
    name,
    children: tree.children,
  };
}

function mergePageTrees(
  specificationTree: Root,
  protocolTree: Root,
  providerTree: Root,
  userTree: Root,
  sdkTree: Root,
  openApiTree: Root,
): Root {
  const sanitizedSpecificationTree = sanitizeTree(specificationTree);
  const mergedProtocolTree = mergeProtocolTree(
    sanitizeTree(protocolTree),
    sanitizeTree(openApiTree),
  );
  const sanitizedProviderTree = sanitizeTree(providerTree);
  const sanitizedUserTree = sanitizeTree(userTree);
  const sanitizedSdkTree = sanitizeTree(sdkTree);

  return {
    name: "IVXP Docs",
    children: [
      createSection("IVXP Protocol Specification", sanitizedSpecificationTree),
      createSection("Protocol", mergedProtocolTree),
      createSection("Provider", sanitizedProviderTree),
      createSection("Service User", sanitizedUserTree),
      createSection("SDK", sanitizedSdkTree),
    ],
  };
}

const tree = mergePageTrees(
  specificationSource.pageTree,
  protocolSource.pageTree,
  providerSource.pageTree,
  userSource.pageTree,
  sdkSource.pageTree,
  openApiSource.pageTree,
);

const HUB_URL =
  process.env.NEXT_PUBLIC_HUB_URL?.trim() ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://ivxp-protocol.vercel.app");

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={tree}
      nav={{
        title: "IVXP Docs",
        url: "/",
        children: (
          <a
            href={HUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
          >
            Back to Hub
          </a>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
