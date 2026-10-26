export const planPresets = {
  basico: { label: "Básico", maxClientes: 3, maxEventos: 3, maxInvitados: 200, qr: false, marca: false },
  pro: { label: "Pro", maxClientes: 10, maxEventos: 10, maxInvitados: 500, qr: true, marca: false },
  elite: { label: "Elite", maxClientes: 50, maxEventos: 50, maxInvitados: 2000, qr: true, marca: true },
} as const;

export type PlanName = keyof typeof planPresets;

export function normalizePlan(value: unknown): PlanName {
  return value === "pro" || value === "elite" ? value : "basico";
}

export function isOrganizationServiceActive(
  organization: { estado_servicio: string; servicio_vence_en: Date | string | null; eliminado_en?: Date | string | null },
  now = new Date(),
) {
  if (organization.eliminado_en) return false;
  if (!['activo', 'prueba'].includes(organization.estado_servicio)) return false;
  return !organization.servicio_vence_en || new Date(organization.servicio_vence_en) >= now;
}

export function organizationBlockMessage(
  organization: { estado_servicio: string; servicio_vence_en: Date | string | null; eliminado_en?: Date | string | null },
) {
  if (organization.eliminado_en) return "La organización está en la papelera.";
  if (organization.estado_servicio === "suspendido") return "El servicio de la organización está suspendido.";
  if (organization.estado_servicio === "vencido" || (organization.servicio_vence_en && new Date(organization.servicio_vence_en) < new Date())) return "La licencia de la organización ha vencido.";
  return "El servicio de la organización no está disponible.";
}
