"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RawJsonViewerProps {
  readonly data: unknown;
}

/** Safely stringify data, handling circular refs and BigInt values. */
function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(
      data,
      (_key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    );
  } catch {
    return "[Unable to serialize data]";
  }
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const formatted = safeStringify(data);

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-2 py-1 text-left text-[10px] text-zinc-400 hover:text-zinc-300"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand raw JSON" : "Collapse raw JSON"}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", !collapsed && "rotate-90")} />
        Raw Wire Format
      </button>
      {!collapsed && (
        <pre className="overflow-x-auto px-3 pb-2 font-mono text-[10px] text-zinc-300">
          {formatted}
        </pre>
      )}
    </div>
  );
}
