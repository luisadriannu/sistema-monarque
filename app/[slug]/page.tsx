import type { Metadata } from "next";
import Image from "next/image";
import prisma from "@/lib/prisma";
import WeddingOliveVintage from "@/app/templates/WeddingOliveVintage";
import WeddingPersonalized from "@/app/templates/WeddingPersonalized";
import carlosYYazmin from "@/app/data/carlosYYazmin";
import type { EventData } from "@/app/types/EventData";
import { getCurrentUser } from "@/lib/auth";
import QRCode from "qrcode";
import { isOrganizationServiceActive } from "@/lib/organization-access";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; token?: string; preview?: string }>;
}

type StoredInvitationData = Omit<Partial<EventData>, "event" | "location" | "media"> & {
  event?: Partial<EventData["event"]>;
  location?: Partial<EventData["location"]>;
};

function isStoredInvitationData(value: unknown): value is StoredInvitationData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const data = value as StoredInvitationData;
  return Boolean(data.event && data.location);
}

export default async function InvitationPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { id, token, preview } = await searchParams;
  const effectiveToken = (id || token || "").trim();
  const isPreview = preview === "1";

  if (!effectiveToken && !isPreview) return <InvitacionNoDisponible />;

  const evento = await prisma.evento.findUnique({
    where: { slug },
    include: { usuario: { select: { organizacion: true } } },
  });
  if (!evento) return <InvitacionNoDisponible />;
  if (evento.usuario.organizacion && !isOrganizationServiceActive(evento.usuario.organizacion)) return <InvitacionNoDisponible />;
  if (!isPreview && ["borrador", "cancelado", "archivado"].includes(evento.estado)) {
    return <InvitacionNoDisponible />;
  }

  let invitado;

  if (isPreview) {
    const user = await getCurrentUser();
    const canPreview =
      user && (user.rol === "admin" || evento.usuario_id === user.id || (user.rol === "organizador" && user.organizacion_id === evento.usuario.organizacion?.id));

    if (!canPreview) return <InvitacionNoDisponible />;

    invitado = {
      nombre: "Invitado de muestra",
      pases_asignados: 2,
      pases_confirmados: null,
      ninos_confirmados: 0,
      estado: "pendiente",
      ultima_respuesta_en: null,
      codigo_entrada: "vista-previa",
      pases_ingresados: 0,
      ultima_entrada_en: null,
    };
  } else {
    invitado = await prisma.invitado.findFirst({
      where: { token: effectiveToken, evento_id: evento.id },
    });

    if (!invitado) return <InvitacionNoDisponible />;
  }

  const expirado = new Date() > new Date(evento.fecha_limite_rsvp);

  const storedInvitation = isStoredInvitationData(evento.configuracion_invitacion)
    ? evento.configuracion_invitacion
    : {};

  const isCarlosYazminInvitation = evento.slug === "boda-yazmin-y-cesar";

  // La boda original conserva su diseño editorial y fotografías locales. Los
  // demás eventos se construyen únicamente con su propia configuración para
  // que nunca hereden nombres, imágenes o contenido de otra clienta.
  const eventData: EventData = isCarlosYazminInvitation
    ? {
        ...carlosYYazmin,
        ...storedInvitation,
        seo: {
          ...carlosYYazmin.seo,
          ...storedInvitation.seo,
          image: carlosYYazmin.seo?.image,
        },
        event: {
          ...carlosYYazmin.event,
          ...storedInvitation.event,
          date: evento.fecha_evento.toISOString(),
        },
        media: carlosYYazmin.media,
        location: {
          ...carlosYYazmin.location,
          ...storedInvitation.location,
          reception: evento.lugar || carlosYYazmin.location.reception,
        },
      }
    : {
        tipo: storedInvitation.tipo || "boda",
        plan: storedInvitation.plan || "elite",
        seo: storedInvitation.seo,
        event: {
          name:
            storedInvitation.event?.name ||
            evento.anfitriones.replace(/\s+y\s+/i, " & "),
          date: evento.fecha_evento.toISOString(),
          startsAt: storedInvitation.event?.startsAt,
          ceremonyHour: storedInvitation.event?.ceremonyHour,
          partyHour: storedInvitation.event?.partyHour,
          phrase:
            storedInvitation.event?.phrase ||
            "Nos encantará compartir contigo este momento especial.",
          dressCode: storedInvitation.event?.dressCode,
          itinerary: storedInvitation.event?.itinerary || [],
        },
        media: { coverImage: "", gallery: [] },
        location: {
          event: storedInvitation.location?.event || "Lugar del evento",
          reception: evento.lugar,
        },
        contact: storedInvitation.contact,
        family: storedInvitation.family,
        design: { variant: "generic" },
      };

  const invitadoData = {
    pases_ingresados: invitado.pases_ingresados,
    ultima_entrada_en: invitado.ultima_entrada_en?.toISOString() || null,
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

  const invitationProps = {
    data: eventData,
    invitado: invitadoData,
    evento: eventoData,
    token: effectiveToken,
    previewMode: isPreview,
  };

  const qrEnabled = Boolean(evento.usuario.organizacion?.qr_checkin_habilitado);
  const qrLimit = invitado.pases_confirmados ?? 0;
  const qrUsed = qrLimit < 1 || invitado.pases_ingresados >= qrLimit || (
    evento.modo_ingreso === "unico" && Boolean(invitado.escaneado_en)
  );
  const qrImage = qrEnabled && !isPreview && invitado.estado === "confirmado" && (invitado.pases_confirmados ?? 0) > 0 && !qrUsed
    ? await QRCode.toDataURL(`monarque:entrada:${invitado.codigo_entrada}`, {
        width: 480,
        margin: 1,
        color: { dark: "#183126", light: "#fffaf0" },
      })
    : null;

  return <>{isCarlosYazminInvitation ? (
      <WeddingOliveVintage {...invitationProps} qrEnabled={qrEnabled} qrImage={qrImage} />
    ) : (
      <WeddingPersonalized {...invitationProps} qrEnabled={qrEnabled} qrImage={qrImage} />
     )}</>;
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
