// Limitador de intentos ligero en memoria por IP (RNF-03)
interface RateRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateRecord>();

export function checkRateLimit(ip: string, maxRequests: number = 30, windowSeconds: number = 60): boolean {
  const now = Date.now();
  const record = ipMap.get(ip);

  // Limpiar registros antiguos periódicamente
  if (ipMap.size > 10000) {
    for (const [key, val] of ipMap.entries()) {
      if (val.resetAt < now) ipMap.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    ipMap.set(ip, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return true; // Permitido
  }

  if (record.count >= maxRequests) {
    return false; // Límite excedido
  }

  record.count += 1;
  return true;
}
