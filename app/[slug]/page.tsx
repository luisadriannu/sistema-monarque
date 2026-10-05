import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import InvitationGuestView from "@/components/InvitationGuestView";
import { Sparkles, ShieldAlert } from "lucide-react";

// RNF-02: Metaetiqueta noindex en las páginas de invitación para que no aparezcan en buscadores
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; token?: string }>;
}

export default async function InvitationPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { id, token } = await searchParams;
  const effectiveToken = (id || token || "").trim();

  // Si no hay token en la URL (RF-23)
  if (!effectiveToken) {
    return <InvitacionNoDisponible />;
  }

  // Buscar evento y luego al invitado por token y slug
  const evento = await prisma.evento.findUnique({
    where: { slug },
  });

  if (!evento) {
    return <InvitacionNoDisponible />;
  }

  const invitado = await prisma.invitado.findFirst({
    where: {
      token: effectiveToken,
      evento_id: evento.id,
    },
  });

  // Si el token no existe, fue regenerado o el invitado fue borrado (RF-15, RF-23)
  if (!invitado) {
    return <InvitacionNoDisponible />;
  }

  // RF-21: Al abrir la invitación con un token válido por primera vez, el estado cambia a Visto
  if (invitado.estado === "pendiente") {
    await prisma.invitado.update({
      where: { id: invitado.id },
      data: { estado: "visto" },
    });
    invitado.estado = "visto";
  }

  const now = new Date();
  const fechaLimite = new Date(evento.fecha_limite_rsvp);
  const expirado = now > fechaLimite;

  // RF-24: Solo enviar los datos permitidos para el invitado
  const invitationData = {
    invitado: {
      nombre: invitado.nombre,
      pases_asignados: invitado.pases_asignados,
      pases_confirmados: invitado.pases_confirmados,
      estado: invitado.estado,
      ultima_respuesta_en: invitado.ultima_respuesta_en?.toISOString() || null,
    },
    evento: {
      nombre: evento.nombre,
      anfitriones: evento.anfitriones,
      fecha_evento: evento.fecha_evento.toISOString(),
      lugar: evento.lugar,
      fecha_limite_rsvp: evento.fecha_limite_rsvp.toISOString(),
      expirado,
    },
  };

  return <InvitationGuestView data={invitationData} token={effectiveToken} />;
}

// Vista genérica de seguridad (RF-23)
function InvitacionNoDisponible() {
  return (
    <main className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#e6d7c3] rounded-3xl p-8 text-center shadow-xl shadow-stone-200/50">
        <div className="w-14 h-14 rounded-2xl bg-[#faf8f5] border border-stone-200 text-stone-400 mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7 text-[#ab8153]" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">
          Invitación No Disponible
        </h1>

        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          El enlace que intentas abrir no es válido o ha expirado. Por favor contacta a los anfitriones del evento para recibir un enlace actualizado.
        </p>

        <div className="h-[1px] w-16 bg-[#c5a059] mx-auto opacity-40 mb-4" />

        <p className="text-[10px] uppercase tracking-widest text-[#ab8153] font-semibold">
          Monarque • Invitaciones Digitales
        </p>
      </div>
    </main>
  );
}
