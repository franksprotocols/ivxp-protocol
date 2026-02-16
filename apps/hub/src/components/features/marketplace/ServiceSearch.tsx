"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ServiceSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function ServiceSearch({ value, onChange }: ServiceSearchProps) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        placeholder="Search services..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
        aria-label="Search services"
      />
    </div>
  );
}
