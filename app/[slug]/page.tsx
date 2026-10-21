import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import WeddingOliveVintage from "@/app/templates/WeddingOliveVintage";
import carlosYYazmin from "@/app/data/carlosYYazmin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; token?: string }>;
}

export default async function InvitationPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { id, token } = await searchParams;
  const effectiveToken = (id || token || "").trim();

  if (!effectiveToken) return <InvitacionNoDisponible />;

  const evento = await prisma.evento.findUnique({ where: { slug } });
  if (!evento) return <InvitacionNoDisponible />;

  const invitado = await prisma.invitado.findFirst({
    where: { token: effectiveToken, evento_id: evento.id },
  });
  if (!invitado) return <InvitacionNoDisponible />;

  const expirado = new Date() > new Date(evento.fecha_limite_rsvp);

  // Mezclar la data estática con los datos dinámicos del evento (lugar y fecha reales de la BD)
  const eventData = {
    ...carlosYYazmin,
    event: {
      ...carlosYYazmin.event,
      date: evento.fecha_evento.toISOString(),
    },
    location: {
      ...carlosYYazmin.location,
      reception: evento.lugar || carlosYYazmin.location.reception,
    },
  };

  const invitadoData = {
    nombre: invitado.nombre,
    pases_asignados: invitado.pases_asignados,
    pases_confirmados: invitado.pases_confirmados,
    ninos_confirmados: invitado.ninos_confirmados,
    estado: invitado.estado,
    ultima_respuesta_en: invitado.ultima_respuesta_en?.toISOString() || null,
  };

  const eventoData = {
    nombre: evento.nombre,
    anfitriones: evento.anfitriones,
    fecha_evento: evento.fecha_evento.toISOString(),
    lugar: evento.lugar,
    fecha_limite_rsvp: evento.fecha_limite_rsvp.toISOString(),
    texto_edad_nino: evento.texto_edad_nino || "menores de 12 años",
    expirado,
  };

  return (
    <WeddingOliveVintage
      data={eventData}
      invitado={invitadoData}
      evento={eventoData}
      token={effectiveToken}
    />
  );
}

function InvitacionNoDisponible() {
  return (
    <main className="min-h-screen bg-[#fbf8f4] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#ebd9c4] rounded-3xl p-8 text-center shadow-xl shadow-stone-200/50">
        <div className="w-16 h-16 rounded-full bg-[#fbf8f4] border border-[#dec0a2] mx-auto flex items-center justify-center mb-4 overflow-hidden relative shadow-xs">
          <Image src="/logo.png" alt="Monarque Invitaciones" width={64} height={64} className="w-full h-full object-cover" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-stone-900 mb-2">Invitación No Disponible</h1>
        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          El enlace que intentas abrir no es válido o ha sido renovado. Por favor contacta a los anfitriones del evento para recibir un enlace actualizado.
        </p>
        <div className="h-[1px] w-16 bg-[#c59b4c] mx-auto opacity-50 mb-4" />
        <p className="text-[10px] uppercase tracking-widest text-[#a3704d] font-semibold">Monarque • Invitaciones Web</p>
      </div>
    </main>
  );
}
