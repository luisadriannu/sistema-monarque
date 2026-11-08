import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma-client-v3";

export class ReceptionCapacityError extends Error {}

// Recheck capacity after a competing transaction commits, so two simultaneous
// requests cannot both occupy the last available place.
export async function withReceptionCapacity<T>(
  organizationId: string,
  isAdmin: boolean,
  existingId: string | undefined,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        if (!isAdmin) {
          const existing = existingId ? await tx.usuario.findUnique({
            where: { id: existingId }, select: { organizacion_id: true, eliminado_en: true },
          }) : null;
          // Editing an active member of this organization consumes no new place.
          if (!existing || existing.eliminado_en || existing.organizacion_id !== organizationId) {
            const organization = await tx.organizacion.findUniqueOrThrow({
              where: { id: organizationId }, select: { max_recepcionistas: true },
            });
            const used = await tx.usuario.count({
              where: { organizacion_id: organizationId, rol: "recepcionista", eliminado_en: null },
            });
            if (used >= organization.max_recepcionistas) {
              throw new ReceptionCapacityError(`Tu capacidad contratada permite hasta ${organization.max_recepcionistas} recepcionistas activos. Desactiva una cuenta o solicita ampliar tu cupo.`);
            }
          }
        }
        return write(tx);
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (attempt < 2 && error && typeof error === "object" && "code" in error && error.code === "P2034") continue;
      throw error;
    }
  }
}
