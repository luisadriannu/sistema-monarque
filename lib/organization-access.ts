export const planPresets = {
  basico: { label: "Inicial", maxClientes: 2, maxEventos: 2, maxInvitados: 200, qr: true, marca: false },
  pro: { label: "Profesional", maxClientes: 5, maxEventos: 5, maxInvitados: 300, qr: true, marca: false },
  // Se conserva para reconocer cuentas antiguas, pero ya no se ofrece en nuevas altas.
  elite: { label: "Agencia", maxClientes: 50, maxEventos: 50, maxInvitados: 2000, qr: true, marca: true },
} as const;

export type PlanName = keyof typeof planPresets;

export function normalizePlan(value: unknown): PlanName {
  return value === "pro" || value === "elite" ? value : "basico";
}

export function normalizeAvailablePlan(value: unknown): Exclude<PlanName, "elite"> {
  return value === "pro" ? "pro" : "basico";
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
