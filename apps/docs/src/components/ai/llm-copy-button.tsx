"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface LLMCopyButtonProps {
    markdownUrl: string;
    className?: string;
}

/**
 * Fetches the Markdown content of a page and copies it to the clipboard.
 * The markdownUrl should point to the /llms.mdx/docs/... route (or via the .mdx rewrite).
 */
export function LLMCopyButton({ markdownUrl, className }: LLMCopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleCopy() {
        if (loading || copied) return;
        setLoading(true);

        try {
            const res = await fetch(markdownUrl);
            const text = await res.text();
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // silently fail — clipboard might be blocked
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleCopy}
            disabled={loading}
            title="Copy page as Markdown (for LLMs)"
            className={[
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                "border border-fd-border bg-fd-background text-fd-muted-foreground",
                "transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
                "disabled:opacity-50",
                className ?? "",
            ].join(" ")}
        >
            {copied ? (
                <>
                    <Check className="size-3.5" />
                    Copied!
                </>
            ) : (
                <>
                    <Copy className="size-3.5" />
                    Copy for LLM
                </>
            )}
        </button>
    );
}
