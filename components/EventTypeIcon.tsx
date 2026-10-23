import { CakeSlice, Church, Crown } from "lucide-react";
import type { EventType } from "@/lib/event-theme";

interface EventTypeIconProps {
  type: EventType;
  className?: string;
  strokeWidth?: number;
}

export default function EventTypeIcon({
  type,
  className = "h-5 w-5",
  strokeWidth = 1.8,
}: EventTypeIconProps) {
  if (type === "cumpleanos") {
    return <CakeSlice className={className} strokeWidth={strokeWidth} />;
  }

  if (type === "bautizo") {
    return <Church className={className} strokeWidth={strokeWidth} />;
  }

  if (type === "xv") {
    return <Crown className={className} strokeWidth={strokeWidth} />;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8.5" cy="14" r="5" />
      <circle cx="15.5" cy="14" r="5" />
      <path d="m12 6-2-2 2-2 2 2-2 2Z" />
      <path d="M12 6v2" />
    </svg>
  );
}
