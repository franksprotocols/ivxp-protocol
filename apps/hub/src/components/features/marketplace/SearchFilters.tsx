"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { FilterState } from "./MarketplaceContent";

interface SearchFiltersProps {
  readonly filters: FilterState;
  readonly onFilterChange: (key: keyof FilterState, value: string) => void;
  readonly onClear: () => void;
}

export function SearchFilters({
  filters,
  onFilterChange,
  onClear,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        value={filters.serviceType || "all"}
        onValueChange={(v) =>
          onFilterChange("serviceType", v === "all" ? "" : v)
        }
      >
        <SelectTrigger
          className="w-[160px]"
          aria-label="Filter by service type"
        >
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="text_echo">Text Echo</SelectItem>
          <SelectItem value="image_gen">Image Gen</SelectItem>
          <SelectItem value="research">Research</SelectItem>
          <SelectItem value="code_review">Code Review</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min $"
          value={filters.minPrice}
          onChange={(e) => onFilterChange("minPrice", e.target.value)}
          className="w-24"
          min="0"
          step="0.01"
          aria-label="Minimum price"
        />
        <Input
          type="number"
          placeholder="Max $"
          value={filters.maxPrice}
          onChange={(e) => onFilterChange("maxPrice", e.target.value)}
          className="w-24"
          min="0"
          step="0.01"
          aria-label="Maximum price"
        />
      </div>

      <Select
        value={filters.sortBy}
        onValueChange={(v) =>
          onFilterChange("sortBy", v as FilterState["sortBy"])
        }
      >
        <SelectTrigger className="w-[140px]" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="relevance">Relevance</SelectItem>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="price">Price</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
