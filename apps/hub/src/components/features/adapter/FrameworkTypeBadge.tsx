import { Badge } from "@/components/ui/badge";
import type { FrameworkType } from "@/lib/adapter-store";

const BADGE_COLORS: Record<FrameworkType, string> = {
  A2A: "bg-blue-100 text-blue-800 border-blue-200",
  LangGraph: "bg-green-100 text-green-800 border-green-200",
  MCP: "bg-purple-100 text-purple-800 border-purple-200",
  Other: "bg-gray-100 text-gray-800 border-gray-200",
};

interface FrameworkTypeBadgeProps {
  readonly type: FrameworkType;
}

export function FrameworkTypeBadge({ type }: FrameworkTypeBadgeProps) {
  const colorClass = BADGE_COLORS[type];

  return (
    <Badge className={colorClass} data-testid="framework-badge">
      {type}
    </Badge>
  );
}
