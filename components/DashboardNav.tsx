"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Settings,
  FileSpreadsheet,
  LogOut,
  ExternalLink,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface DashboardNavProps {
  user: {
    nombre: string;
    email: string;
    rol: string;
  };
  eventSlug?: string;
}

export default function DashboardNav({ user, eventSlug }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    {
      label: "Métricas y Resumen",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Lista de Invitados",
      href: "/dashboard/invitados",
      icon: Users,
    },
    {
      label: "Gestionar Evento",
      href: "/dashboard/configuracion",
      icon: Settings,
    },
    {
      label: "Exportar Banquetero",
      href: "/dashboard/exportar",
      icon: FileSpreadsheet,
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Error al salir", e);
    }
  };

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#c5a059]" />
          <span className="font-serif font-bold tracking-wide text-stone-900 text-lg">
            MONARQUE
          </span>
          <span className="text-[10px] bg-[#f3ede3] text-[#795337] px-2 py-0.5 rounded-full font-medium">
            Elite
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-stone-600 hover:text-stone-900"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-stone-200 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          {/* Logo Monarque */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#faf8f5] border border-[#e6d7c3] flex items-center justify-center text-[#c5a059] shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold tracking-wide text-stone-900 leading-none">
                MONARQUE
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-[#ab8153] font-semibold mt-1">
                Plan Elite
              </p>
            </div>
          </div>

          {/* Menú de navegación */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-stone-900 text-white shadow-sm"
                      : "text-stone-600 hover:bg-[#faf8f5] hover:text-stone-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#c5a059]" : "text-stone-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Enlace rápido a ver invitación */}
          {eventSlug && (
            <div className="mt-8 pt-6 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Página pública
              </p>
              <a
                href={`/${eventSlug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 bg-[#faf8f5] border border-stone-200 rounded-xl text-xs font-medium text-stone-700 hover:border-[#c5a059] hover:text-[#946943] transition-colors group"
              >
                <span className="truncate">/{eventSlug}</span>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#946943]" />
              </a>
            </div>
          )}
        </div>

        {/* Footer de usuario */}
        <div className="p-4 border-t border-stone-100 bg-[#faf8f5]/60">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-sm font-semibold text-stone-900 truncate">{user.nombre}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-stone-900/40 z-40 lg:hidden backdrop-blur-sm"
        />
      )}
    </>
  );
}
