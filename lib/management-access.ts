type Manager = { rol: string; organizacion_id: string | null };

export function canManageAccounts(user: Manager | null | undefined): user is Manager {
  return Boolean(user && (user.rol === "admin" || (user.rol === "organizador" && user.organizacion_id)));
}

export function accountScope(user: Manager) {
  return user.rol === "admin" ? {} : { organizacion_id: user.organizacion_id! };
}

// Grupo interno para clientes atendidos directamente por Monarque. No requiere
// una cuenta de organizador y conserva el aislamiento de las demás organizaciones.
export const DIRECT_ORGANIZATION_ID = "monarque-clientes-directos";
export const directOrganizationData = {
  id: DIRECT_ORGANIZATION_ID,
  nombre: "Clientes directos de Monarque",
  plan: "elite",
  estado_servicio: "activo",
  qr_checkin_habilitado: true,
  max_clientes: 2147483647,
  max_eventos_activos: 2147483647,
  max_invitados_evento: 2147483647,
  marca_personalizada: true,
};
