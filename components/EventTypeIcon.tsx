import { CakeSlice, Crown } from "lucide-react";
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
    return (
      <span
        className={`inline-flex items-center justify-center select-none font-normal leading-none shrink-0 ${className}`}
        style={{ width: "auto", minWidth: "1em" }}
        role="img"
        aria-label="Bautizo"
      >
        👼🏻🤍
      </span>
    );
  }

  if (type === "xv") {
    return <Crown className={className} strokeWidth={strokeWidth} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center select-none font-normal leading-none shrink-0 ${className}`}
      style={{ width: "auto", minWidth: "1em" }}
      role="img"
      aria-label="Boda"
    >
      👰💐
    </span>
  );
}
