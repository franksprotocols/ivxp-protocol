"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, MessageCircle, Github, ChevronDown, FileText } from "lucide-react";

interface ViewOptionsProps {
    markdownUrl: string;
    githubUrl?: string;
    className?: string;
}

/**
 * Shows links to view the page as raw Markdown or on GitHub.
 */
export function ViewOptions({ markdownUrl, githubUrl, className }: ViewOptionsProps) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div
            className={[
                "inline-flex items-center gap-1",
                className ?? "",
            ].join(" ")}
        >
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-fd-border bg-fd-background text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                >
                    Open in...
                    <ChevronDown className="size-3.5" />
                </button>
                {open && (
                    <div className="absolute top-full left-0 mt-1 w-48 p-1 flex flex-col gap-1 rounded-md border border-fd-border bg-fd-background shadow-md z-50">
                        <button
                            type="button"
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors w-full text-left"
                            onClick={(e) => {
                                e.preventDefault();
                                const prompt = `Read ${window.location.href} I want to ask questions about it.`;
                                window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener,noreferrer");
                                setOpen(false);
                            }}
                        >
                            <MessageSquare className="size-4" />
                            Open in Claude
                        </button>
                        <button
                            type="button"
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors w-full text-left"
                            onClick={(e) => {
                                e.preventDefault();
                                const prompt = `Read ${window.location.href} I want to ask questions about it.`;
                                window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, "_blank", "noopener,noreferrer");
                                setOpen(false);
                            }}
                        >
                            <MessageCircle className="size-4" />
                            Open in ChatGPT
                        </button>
                        <hr className="my-1 border-fd-border" />
                        <a
                            href={markdownUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground transition-colors"
                            onClick={() => setOpen(false)}
                        >
                            <FileText className="size-4" />
                            View as Markdown
                        </a>
                    </div>
                )}
            </div>

            {githubUrl && (
                <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-fd-border bg-fd-background text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                >
                    <Github className="size-3.5" />
                    GitHub
                </a>
            )}
        </div>
    );
}
