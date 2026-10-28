export const attendanceLockMessage = "Ya se registró un ingreso. Los pases, la confirmación y el enlace de esta invitación están bloqueados para todos los usuarios.";
export function hasAttendance(guest: { pases_liberados?: boolean; pases_ingresados?: number; ultima_entrada_en?: unknown; escaneado_en?: unknown }) {
  return Boolean(guest.pases_liberados || (guest.pases_ingresados ?? 0) > 0 || guest.ultima_entrada_en || guest.escaneado_en);
}
export const noAttendance = { pases_liberados: false, pases_ingresados: 0, ultima_entrada_en: null, escaneado_en: null } as const;
