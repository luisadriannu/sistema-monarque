import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardNav from "@/components/DashboardNav";
import SessionActivity from "@/components/SessionActivity";
import {
  eventTypeThemes,
  getEventTypeFromConfig,
  monarqueDashboardTheme,
} from "@/lib/event-theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // El menú del administrador no depende de ningún evento. Esto evita que se
  // seleccione accidentalmente el evento más reciente de otra clienta.
  const evento =
    user.rol !== "clienta"
      ? null
      : await prisma.evento.findFirst({
          where: { usuario_id: user.id },
          orderBy: { creado_en: "desc" },
        });

  const eventType = evento
    ? getEventTypeFromConfig(evento.configuracion_invitacion)
    : null;
  const dashboardTheme = eventType
    ? eventTypeThemes[eventType]
    : monarqueDashboardTheme;
  const themeVariables = {
    "--dashboard-accent": dashboardTheme.accent,
    "--dashboard-accent-strong": dashboardTheme.accentStrong,
    "--dashboard-soft": dashboardTheme.soft,
    "--dashboard-soft-border": dashboardTheme.softBorder,
    "--dashboard-ink": dashboardTheme.ink,
  } as CSSProperties;

  return (
    <div
      className="dashboard-theme min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col lg:flex-row"
      style={themeVariables}
    >
      <DashboardNav
        user={user}
        eventSlug={evento?.slug}
        eventTypeLabel={eventType ? eventTypeThemes[eventType].label : undefined}
        eventType={eventType || undefined}
        qrCheckinEnabled={Boolean(
          user.organizacion?.qr_checkin_habilitado
          && (user.rol !== "recepcionista" || user.lector_qr_habilitado),
        )}
      />
      <main className="min-w-0 flex-1 lg:pl-64 min-h-screen flex flex-col">
        <SessionActivity />
        <div className="min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
