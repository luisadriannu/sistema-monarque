"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Eye,
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

  // 3 secciones principales claras: Resumen, Invitados, Configuración
  const navItems = [
    {
      label: "Resumen",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Invitados",
      href: "/dashboard/invitados",
      icon: Users,
    },
    {
      label: "Configuración",
      href: "/dashboard/configuracion",
      icon: Settings,
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
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[#ebd9c4] shrink-0">
            <Image
              src="/logo.png"
              alt="Monarque"
              width={36}
              height={36}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <span className="font-serif font-bold tracking-wide text-stone-900 text-base leading-none block">
              MONARQUE
            </span>
            <span className="text-[10px] text-[#e05a1b] font-medium tracking-wider">
              Invitaciones Web
            </span>
          </div>
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#ebd9c4]/70 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          {/* Logo Monarque con mariposa y tipografía */}
          <div className="flex items-center gap-3 mb-8 pb-5 border-b border-[#f5ede2]">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-[#ebd9c4] shadow-xs shrink-0 bg-white">
              <Image
                src="/logo.png"
                alt="Monarque"
                width={48}
                height={48}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-wide text-[#2b211b] leading-tight">
                MONARQUE
              </h1>
              <span className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-semibold bg-[#ffedd5] text-[#c2410c]">
                Plan Elite
              </span>
            </div>
          </div>

          {/* Menú de navegación de 3 secciones */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? "bg-[#2b211b] text-white shadow-sm"
                      : "text-stone-600 hover:bg-[#fbf8f4] hover:text-[#2b211b]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#e05a1b]" : "text-stone-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#e05a1b]" />}
                </Link>
              );
            })}
          </nav>

          {/* Enlace rápido a ver invitación */}
          {eventSlug && (
            <div className="mt-8 pt-6 border-t border-[#f5ede2]">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
                Página pública
              </p>
              <a
                href={`/${eventSlug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs font-medium text-stone-700 hover:border-[#e05a1b] hover:text-[#e05a1b] transition-all group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Eye className="w-3.5 h-3.5 text-[#e05a1b]" />
                  <span className="truncate text-[11px]">/{eventSlug}</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#e05a1b] shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Footer de usuario */}
        <div className="p-4 border-t border-[#f5ede2] bg-[#fbf8f4]/60">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-semibold text-stone-900 truncate">{user.nombre}</p>
              <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
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
          className="fixed inset-0 bg-stone-900/40 z-40 lg:hidden backdrop-blur-xs"
        />
      )}
    </>
  );
}
