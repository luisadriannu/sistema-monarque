import crypto from "crypto";

/**
 * Genera un token aleatorio, seguro y único de longitud especificada (por defecto 14 caracteres).
 * Cumple con RNF-01: mínimo 12 caracteres, alfanumérico seguro para URLs, no adivinable.
 */
export function generateInvitationToken(length: number = 14): string {
  // Caracteres URL-safe legibles y sin ambigüedades
  const alphabet = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}
