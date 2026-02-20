import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { Item, Node, Root } from "fumadocs-core/page-tree";
import { sdkSource, protocolSource } from "@/lib/source";

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

// Merge two page trees under a single root with two top-level sections.
function mergePageTrees(sdkTree: Root, protocolTree: Root): Root {
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
        index: findFirstPageItem(protocolTree.children),
        children: protocolTree.children,
      },
    ],
  };
}

const tree = mergePageTrees(sdkSource.pageTree, protocolSource.pageTree);

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
