import type { PlayerProfileDto } from "@top-seed/contracts";
import { prisma } from "../../shared/infrastructure/prisma/client.js";
import { UseCaseError } from "../../shared/application/errors.js";

export interface CreatePlayerProfileInput {
  id: string;
  organizationId: string;
  displayName: string;
  phone?: string;
  defaultSkillRating?: number;
  notes?: string;
  isActive?: boolean;
}

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

export async function createPlayerProfile(input: CreatePlayerProfileInput): Promise<{
  profile: PlayerProfileDto;
}> {
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!organization) {
    throw new UseCaseError("VALIDATION_ERROR", "Organization not found.");
  }

  const row = await prisma.playerProfile.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      organizationId: input.organizationId,
      displayName: input.displayName,
      phone: input.phone ?? "",
      defaultSkillRating: input.defaultSkillRating ?? 3,
      notes: input.notes ?? "",
      isActive: input.isActive ?? true,
    },
    update: {
      displayName: input.displayName,
      phone: input.phone ?? "",
      defaultSkillRating: input.defaultSkillRating ?? 3,
      notes: input.notes ?? "",
      isActive: input.isActive ?? true,
    },
  });

  return { profile: toDto(row) };
}
