export const eventTypeThemes = {
  boda: {
    label: "Boda",
    accent: "#A75D67",
    accentStrong: "#7C3F4A",
    soft: "#F8E8EB",
    softBorder: "#EBC7CD",
    ink: "#422B31",
  },
  cumpleanos: {
    label: "Cumpleaños",
    accent: "#7C4DCC",
    accentStrong: "#5E35A5",
    soft: "#F0E8FF",
    softBorder: "#D8C2FA",
    ink: "#32224A",
  },
  bautizo: {
    label: "Bautizo",
    accent: "#4F86A6",
    accentStrong: "#35667F",
    soft: "#E8F3F8",
    softBorder: "#C5DFEA",
    ink: "#203B49",
  },
  xv: {
    label: "XV años",
    accent: "#B2457A",
    accentStrong: "#8E315F",
    soft: "#F9E6F0",
    softBorder: "#ECC1D6",
    ink: "#4D2539",
  },
} as const;

export type EventType = keyof typeof eventTypeThemes;

export const monarqueDashboardTheme = {
  label: "Administración",
  accent: "#E05A1B",
  accentStrong: "#C2410C",
  soft: "#FFF0E4",
  softBorder: "#FED7AA",
  ink: "#2B211B",
} as const;

export const genericInvitationTheme = {
  background: "#F5F1EA",
  surface: "#FFFDFA",
  primary: "#3F3832",
  secondary: "#DED5C8",
  accent: "#A8875B",
  ink: "#292522",
  muted: "#746B63",
} as const;

export function normalizeEventType(
  value: unknown,
  fallback: EventType = "boda",
): EventType {
  const candidate = String(value || "").toLowerCase();
  return candidate in eventTypeThemes ? (candidate as EventType) : fallback;
}

export function getEventTypeFromConfig(value: unknown): EventType {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "boda";

  const config = value as Record<string, unknown>;
  const system =
    config.system && typeof config.system === "object" && !Array.isArray(config.system)
      ? (config.system as Record<string, unknown>)
      : null;

  return normalizeEventType(system?.eventType || config.tipo);
}
