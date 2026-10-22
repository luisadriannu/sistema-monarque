"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  LayoutDashboard,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Eye,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  const reduceMotion = useReducedMotion();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

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

  const openLogoutModal = () => {
    setMobileMenuOpen(false);
    setLogoutError(null);
    setLogoutModalOpen(true);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("No se pudo cerrar la sesión. Inténtalo nuevamente.");
      }

      window.location.replace("/login");
    } catch (error) {
      console.error("Error al salir", error);
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al cerrar la sesión.",
      );
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!logoutModalOpen || isLoggingOut) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLogoutModalOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [logoutModalOpen, isLoggingOut]);

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white border-b border-stone-200 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between sticky top-0 z-40">
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
                  className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-stone-600 hover:bg-[#fbf8f4] hover:text-[#2b211b]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="dashboard-active-nav"
                      className="absolute inset-0 rounded-xl bg-[#2b211b] shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#e05a1b]" : "text-stone-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-[#e05a1b]" />}
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
                href={`/${eventSlug}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-xs font-medium text-stone-700 hover:border-[#e05a1b] hover:text-[#e05a1b] transition-all group"
              >
                <div className="flex items-center gap-2 truncate">
                  <Eye className="w-3.5 h-3.5 text-[#e05a1b]" />
                  <span className="truncate text-[11px]">Vista previa</span>
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
              onClick={openLogoutModal}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-stone-900/40 z-40 lg:hidden backdrop-blur-xs"
        />
        )}
      </AnimatePresence>

      {/* Confirmación y estado de cierre de sesión */}
      <AnimatePresence>
        {logoutModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
            onClick={() => {
              if (!isLoggingOut) setLogoutModalOpen(false);
            }}
            className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-modal-title"
              aria-describedby="logout-modal-description"
              initial={
                reduceMotion ? false : { opacity: 0, y: 18, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#eadbca] bg-white p-6 text-center shadow-[0_28px_80px_rgba(43,33,27,.3)]"
            >
              {isLoggingOut ? (
                <div className="py-5" aria-live="polite">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4e9] text-[#e05a1b]">
                    <LoaderCircle className="h-8 w-8 animate-spin" />
                  </div>
                  <h2
                    id="logout-modal-title"
                    className="mt-5 font-serif text-2xl font-bold text-[#2b211b]"
                  >
                    Cerrando sesión
                  </h2>
                  <p
                    id="logout-modal-description"
                    className="mt-2 text-sm leading-relaxed text-stone-500"
                  >
                    Espera un momento mientras protegemos tu cuenta.
                  </p>
                  <div className="mx-auto mt-6 h-1 w-36 overflow-hidden rounded-full bg-stone-100">
                    <motion.span
                      className="block h-full rounded-full bg-gradient-to-r from-[#e05a1b] to-[#f59e0b]"
                      animate={reduceMotion ? { width: "70%" } : { x: ["-100%", "250%"] }}
                      transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                      style={{ width: "42%" }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLogoutModalOpen(false)}
                    aria-label="Cerrar confirmación"
                    className="absolute right-4 top-4 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <h2
                    id="logout-modal-title"
                    className="mt-4 font-serif text-2xl font-bold text-[#2b211b]"
                  >
                    ¿Cerrar sesión?
                  </h2>
                  <p
                    id="logout-modal-description"
                    className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-500"
                  >
                    Tendrás que ingresar nuevamente tus credenciales para volver al panel.
                  </p>

                  {logoutError && (
                    <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-xs text-rose-700">
                      {logoutError}
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLogoutModalOpen(false)}
                      className="rounded-xl px-5 py-2.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d9480f] to-[#e05a1b] px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:from-[#c2410c] hover:to-[#d9480f]"
                    >
                      <LogOut className="h-4 w-4" />
                      Sí, cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
