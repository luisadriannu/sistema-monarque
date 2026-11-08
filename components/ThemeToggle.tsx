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
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
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
        aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-[#fbf8f4] text-stone-600 transition-colors hover:border-[#e05a1b] hover:text-[#e05a1b] dark:border-[#2b2d31] dark:bg-[#1e1f22] dark:text-[#f2f3f5] dark:hover:border-[#3f4147] dark:hover:bg-[#2b2d31] ${className}`}
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-stone-700" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`group flex w-full items-center justify-between rounded-xl border border-[#ebd9c4]/70 bg-[#fbf8f4]/80 px-3 py-2 text-xs font-semibold text-stone-700 transition-all hover:border-[#e05a1b] hover:bg-white hover:text-stone-900 dark:border-[#2b2d31] dark:bg-[#18191c] dark:text-[#f2f3f5] dark:hover:border-[#3f4147] dark:hover:bg-[#232428] ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white shadow-xs dark:bg-[#111214]">
          {isDark ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-stone-700" />
          )}
        </span>
        <span className="text-left font-medium">
          Modo oscuro
        </span>
      </div>
      <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:bg-[#2b2d31] dark:text-[#dbdee1]">
        {isDark ? "Activo" : "Inactivo"}
      </span>
    </button>
  );
}
