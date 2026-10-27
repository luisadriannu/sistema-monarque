import prisma from "@/lib/prisma";
import { accountScope } from "@/lib/management-access";

export async function receptionOrganization(
  eventIds: string[],
  user: { rol: string; organizacion_id: string | null },
) {
  const events = await prisma.evento.findMany({
    where: { id: { in: eventIds }, usuario: { ...accountScope(user), eliminado_en: null } },
    select: { usuario: { select: { organizacion_id: true } } },
  });
  if (!eventIds.length || events.length !== eventIds.length) return null;
  const organizationIds = new Set(events.map(event => event.usuario.organizacion_id));
  if (organizationIds.size !== 1) return null;
  return events[0].usuario.organizacion_id;
}
