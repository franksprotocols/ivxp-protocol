"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FRAMEWORK_TYPES, type FrameworkType } from "@/lib/adapter-store";

const FILTER_OPTIONS: readonly (FrameworkType | "All")[] = ["All", ...FRAMEWORK_TYPES];

export function FrameworkTypeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("frameworkType") ?? "All";

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "All") {
        params.delete("frameworkType");
      } else {
        params.set("frameworkType", value);
      }
      router.push(`/adapters?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by framework type">
      {FILTER_OPTIONS.map((option) => {
        const isActive = option === current;
        return (
          <Button
            key={option}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => handleChange(option)}
            aria-pressed={isActive}
            className="transition-colors"
          >
            {option}
          </Button>
        );
      })}
    </div>
  );
}
