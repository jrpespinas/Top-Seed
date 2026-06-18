import type { UpdatePlayerProfilePayload, PlayerProfileDto } from "@top-seed/contracts";
import { prisma } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

function toDto(row: {
  id: string;
  organizationId: string;
  displayName: string;
  phone: string;
  defaultSkillRating: number;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PlayerProfileDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    displayName: row.displayName,
    phone: row.phone || undefined,
    defaultSkillRating: row.defaultSkillRating,
    notes: row.notes || undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePlayerProfile(input: {
  playerProfileId: string;
  payload: UpdatePlayerProfilePayload;
}): Promise<{ profile: PlayerProfileDto }> {
  const existing = await prisma.playerProfile.findUnique({
    where: { id: input.playerProfileId },
  });
  if (!existing) {
    throw new UseCaseError("PLAYER_NOT_FOUND", "Player not found.");
  }

  const row = await prisma.playerProfile.update({
    where: { id: input.playerProfileId },
    data: {
      displayName: input.payload.displayName,
      phone: input.payload.phone ?? "",
      defaultSkillRating: input.payload.defaultSkillRating,
      notes: input.payload.notes ?? "",
    },
  });

  return { profile: toDto(row) };
}
