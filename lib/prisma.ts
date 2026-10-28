import { PrismaClient } from "@/generated/prisma-client-v3";

// Version the development cache when generated models change. Next's hot
// reload preserves globals, including clients created with an older schema.
const globalForPrisma = global as unknown as { prismaReleasedPassesV1: PrismaClient };

export const prisma =
  globalForPrisma.prismaReleasedPassesV1 ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaReleasedPassesV1 = prisma;

export default prisma;
