import { hasAttendance } from "@/lib/attendance-lock";
import { DIRECT_ORGANIZATION_ID } from "@/lib/management-access";

export function contractedPassLimit(event: { limite_pases: number | null; usuario: { organizacion_id: string | null; organizacion?: { max_invitados_evento: number } | null } }) {
  const limits = [event.limite_pases, event.usuario.organizacion_id === DIRECT_ORGANIZATION_ID ? null : event.usuario.organizacion?.max_invitados_evento].filter((n): n is number => typeof n === "number" && n > 0);
  return limits.length ? Math.min(...limits) : null;
}

type PassGuest = { pases_asignados: number; pases_confirmados: number | null; estado: string; pases_liberados?: boolean; pases_ingresados?: number; ultima_entrada_en?: unknown; escaneado_en?: unknown };
export function recoveredPasses(guest: PassGuest) {
  if (guest.pases_liberados && guest.estado === "declinado") return guest.pases_asignados;
  return hasAttendance(guest) ? Math.max(0, guest.pases_asignados - Math.max(guest.pases_confirmados ?? 0, guest.pases_ingresados ?? 0)) : 0;
}
export function committedPasses(guest: PassGuest) { return guest.pases_asignados - recoveredPasses(guest); }
export function releasablePasses(guest: PassGuest) { return guest.estado === "declinado" && !guest.pases_liberados && !hasAttendance(guest) ? guest.pases_asignados : 0; }
