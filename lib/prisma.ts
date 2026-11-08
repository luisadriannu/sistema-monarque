import { PrismaClient } from "@/generated/prisma-client-v3";

// Version the development cache when generated models change. Next's hot
// reload preserves globals, including clients created with an older schema.
const globalForPrisma = global as unknown as { prismaReceptionCapacityV3: PrismaClient };

export const prisma =
  globalForPrisma.prismaReceptionCapacityV3 ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaReceptionCapacityV3 = prisma;

export default prisma;
