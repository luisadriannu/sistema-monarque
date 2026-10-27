// Una misma regla para formularios, importaciones y API.
export const NAME_PATTERN = String.raw`\p{L}[\p{L}\p{M} ]*`;
export const NAME_ERROR = "El nombre solo puede contener letras y espacios (se permiten acentos y ñ).";

export function isValidName(value: unknown): value is string {
  return typeof value === "string" && /^\p{L}[\p{L}\p{M} ]*$/u.test(value.trim());
}

export function lettersOnly(value: string): string {
  return value.normalize("NFC").replace(/[^\p{L}\p{M} ]/gu, "");
}

export const nameInputProps = { pattern: NAME_PATTERN, title: NAME_ERROR };
