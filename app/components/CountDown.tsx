"use client";

import { useState, useEffect } from "react";
import type { EventData } from "@/app/types/EventData";

export default function CountDown({ data }: { data: EventData }) {
  const target = new Date(data.event.date).getTime();

  const calc = () => {
    const diff = target - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { label: "Días", value: time.d },
    { label: "Horas", value: time.h },
    { label: "Min", value: time.m },
    { label: "Seg", value: time.s },
  ];

  return (
    <div className="flex justify-center gap-6 py-4">
      {units.map(({ label, value }) => (
        <div key={label} className="text-center">
          <span className="block text-4xl font-medium text-[#FFF9EE] tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 block text-[9px] uppercase tracking-[0.22em] text-[#D2B777]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
