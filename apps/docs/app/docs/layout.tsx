import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Item, Node, Root } from "fumadocs-core/page-tree";
import { openApiSource, sdkSource, protocolSource } from "@/lib/source";

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
        index: findFirstPageItem(openApiTree.children),
        children: openApiTree.children,
      },
    ],
  };
}

// Merge page trees under a single root with two top-level sections.
function mergePageTrees(sdkTree: Root, protocolTree: Root, openApiTree: Root): Root {
  const mergedProtocolTree = mergeProtocolTree(protocolTree, openApiTree);

  return {
    name: "IVXP Docs",
    children: [
      {
        type: "folder",
        name: "SDK",
        index: findFirstPageItem(sdkTree.children),
        children: sdkTree.children,
      },
      {
        type: "folder",
        name: "Protocol",
        index: findFirstPageItem(mergedProtocolTree.children),
        children: mergedProtocolTree.children,
      },
    ],
  };
}

const tree = mergePageTrees(sdkSource.pageTree, protocolSource.pageTree, openApiSource.pageTree);

export default function DocsLayoutWrapper({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={tree}
      nav={{
        title: "IVXP Docs",
        url: "/",
      }}
    >
      {children}
    </DocsLayout>
  );
}
