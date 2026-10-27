import { DIRECT_ORGANIZATION_ID } from "./management-access";

// En clientas directas este permiso se contrata por cuenta; en las demás se hereda.
export function hasClientQr(user: { organizacion_id?: string | null; lector_qr_habilitado?: boolean; organizacion?: { id?: string; qr_checkin_habilitado: boolean } | null }) {
  const direct = (user.organizacion_id ?? user.organizacion?.id) === DIRECT_ORGANIZATION_ID;
  return direct ? Boolean(user.lector_qr_habilitado) : Boolean(user.organizacion?.qr_checkin_habilitado);
}
