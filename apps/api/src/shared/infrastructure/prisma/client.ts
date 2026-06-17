import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function bumpSessionVersion(sessionId: string): Promise<number> {
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { serverVersion: { increment: 1 } },
    select: { serverVersion: true },
  });
  return session.serverVersion;
}
