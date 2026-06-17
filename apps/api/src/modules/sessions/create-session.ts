import type { SessionDto } from "@top-seed/contracts";
import { prisma, bumpSessionVersion } from "../../shared/infrastructure/prisma/client.js";

export interface CreateSessionInput {
  id: string;
  organizationId: string;
  name: string;
  venueName: string;
  startsAt: string;
  feeAmount: number;
  currency?: string;
  queueMode?: "suggested" | "manual";
  ratingMode?: "casual" | "rated";
  courtCount?: number;
}

function toSessionDto(row: {
  id: string;
  organizationId: string;
  name: string;
  venueName: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  feeAmount: number;
  currency: string;
  queueMode: string;
  requirePaymentBeforePlay: boolean;
  ratingMode: string;
  createdAt: Date;
  updatedAt: Date;
}): SessionDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    venueName: row.venueName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    status: row.status as SessionDto["status"],
    feeAmount: row.feeAmount,
    currency: row.currency,
    queueMode: row.queueMode as SessionDto["queueMode"],
    requirePaymentBeforePlay: row.requirePaymentBeforePlay,
    ratingMode: row.ratingMode as SessionDto["ratingMode"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createSession(input: CreateSessionInput): Promise<SessionDto> {
  const courtCount = input.courtCount ?? 2;
  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.session.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name,
        venueName: input.venueName,
        startsAt: new Date(input.startsAt),
        status: "draft",
        feeAmount: input.feeAmount,
        currency: input.currency ?? "PHP",
        queueMode: input.queueMode ?? "suggested",
        ratingMode: input.ratingMode ?? "casual",
      },
    });

    await tx.queueLane.create({
      data: {
        id: `${input.id}-lane-1`,
        sessionId: input.id,
        name: "Next",
        sortOrder: 0,
      },
    });

    for (let i = 0; i < courtCount; i++) {
      await tx.court.create({
        data: {
          id: `${input.id}-court-${i + 1}`,
          sessionId: input.id,
          name: `Court ${i + 1}`,
          sortOrder: i,
        },
      });
    }

    return created;
  });

  return toSessionDto(session);
}

export async function startSession(sessionId: string): Promise<SessionDto> {
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { status: "active" },
  });
  await bumpSessionVersion(sessionId);
  return toSessionDto(session);
}
