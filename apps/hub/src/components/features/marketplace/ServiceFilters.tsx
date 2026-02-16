"use client";

import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/types/service";
import { Button } from "@/components/ui/button";

interface ServiceFiltersProps {
  readonly activeCategory: ServiceCategory;
  readonly onChange: (category: ServiceCategory) => void;
}

export function ServiceFilters({ activeCategory, onChange }: ServiceFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {SERVICE_CATEGORIES.map((category) => {
        const isActive = category === activeCategory;
        return (
          <Button
            key={category}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(category)}
            aria-pressed={isActive}
            className="transition-colors"
          >
            {category}
          </Button>
        );
      })}
    </div>
  );
}
