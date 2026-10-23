import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TIMEZONE = "America/Mexico_City";

function dateKeyInMexico(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (isNaN(value.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

/** Indica si ya terminó el día completo del evento en horario de México. */
export function isEventFinished(
  eventDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventDate) return false;
  const eventKey = dateKeyInMexico(eventDate);
  const todayKey = dateKeyInMexico(now);
  return Boolean(eventKey && todayKey && todayKey > eventKey);
}

/**
 * Formatea fechas a formato dd/mm/aaaa en zona horaria de México (America/Mexico_City)
 */
export function formatDateMx(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(d);
}

/**
 * Formatea fecha y hora dd/mm/aaaa hh:mm a. m. / p. m.
 */
export function formatDateTimeMx(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIMEZONE,
  }).format(d);
}

/**
 * Formato largo para invitaciones (ej. "Sábado 25 de Octubre de 2026")
 */
export function formatDateLongMx(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const formatted = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(d);

  // Capitalizar primer letra del día de la semana
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Obtiene solo la parte YYYY-MM-DD para un input type="date" en zona horaria de México
 */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

/**
 * Obtiene YYYY-MM-DDTHH:mm para un input type="datetime-local" en zona horaria de México
 */
export function toDateTimeInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  let hour = parts.find((p) => p.type === "hour")?.value || "00";
  if (hour === "24") hour = "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convierte una fecha elegida en un input date (YYYY-MM-DD) a final del día (23:59:59.999) en México
 */
export function endOfDayMexicoDate(dateStr: string): Date {
  // dateStr ej: "2026-11-20"
  // Creamos la fecha a las 23:59:59 en horario de México (-06:00 estándar)
  return new Date(`${dateStr}T23:59:59.999-06:00`);
}
