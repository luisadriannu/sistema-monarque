"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({
  compact = false,
  className = "",
}: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDark = document.documentElement.classList.contains("dark");
    setIsDark(hasDark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("monarque_theme", "dark");
      } catch {
        // Ignorar excepciones de cuota o navegación privada
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("monarque_theme", "light");
      } catch {
        // Ignorar excepciones de cuota o navegación privada
      }
    }
  };

  if (!mounted) {
    return compact ? (
      <div className={`h-9 w-9 rounded-xl ${className}`} />
    ) : (
      <div className={`h-10 w-full rounded-xl ${className}`} />
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro (azul noche)"}
        title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro (azul noche)"}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-[#fbf8f4] text-stone-600 transition-colors hover:border-[#e05a1b] hover:text-[#e05a1b] dark:border-[#20315c] dark:bg-[#142040] dark:text-sky-300 dark:hover:border-sky-400 dark:hover:text-sky-200 ${className}`}
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-slate-600" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro (azul noche)"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro (azul noche)"}
      className={`group flex w-full items-center justify-between rounded-xl border border-[#ebd9c4]/70 bg-[#fbf8f4]/80 px-3 py-2 text-xs font-semibold text-stone-700 transition-all hover:border-[#e05a1b] hover:bg-white hover:text-stone-900 dark:border-[#20315c] dark:bg-[#121c38] dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-[#162347] ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-[#0c152a]">
          {isDark ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-slate-600" />
          )}
        </span>
        <span className="text-left font-medium">
          {isDark ? "Modo oscuro" : "Modo oscuro"}
        </span>
      </div>
      <span className="rounded-full bg-stone-200/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:bg-[#1e2f5b] dark:text-sky-300">
        {isDark ? "Azul noche" : "Inactivo"}
      </span>
    </button>
  );
}
