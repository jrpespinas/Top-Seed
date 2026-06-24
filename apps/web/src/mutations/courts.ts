import { db } from "../db/database.js";
import type { LocalCourt } from "../db/types.js";
import { requireSession } from "../lib/mutation-utils.js";
import { applyMutation, runInTransaction } from "./applyMutation.js";
import { enqueueSyncAction } from "../sync/outbox.js";

const MAX_COURTS = 8;
const MIN_COURTS = 1;

export function courtNameForIndex(index: number): string {
  return `Court ${index + 1}`;
}

async function listSessionCourts(sessionId: string): Promise<LocalCourt[]> {
  return db.courts.where("sessionId").equals(sessionId).sortBy("sortOrder");
}

async function renumberSessionCourtsLocal(sessionId: string, organizationId: string): Promise<void> {
  const courts = await listSessionCourts(sessionId);

  for (const [index, court] of courts.entries()) {
    const name = courtNameForIndex(index);
    const sortOrder = index;
    if (court.name === name && court.sortOrder === sortOrder) {
      continue;
    }

    await db.courts.update(court.id, { name, sortOrder });
    await enqueueSyncAction({
      id: crypto.randomUUID(),
      organizationId,
      type: "UPDATE_COURT",
      entityType: "court",
      entityId: court.id,
      sessionId,
      payload: { name, sortOrder },
      createdAt: new Date().toISOString(),
    });
  }
}

export async function createCourtLocal(input: {
  id: string;
  sessionId: string;
}): Promise<LocalCourt> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const courts = await listSessionCourts(input.sessionId);
        if (courts.length >= MAX_COURTS) {
          throw new Error(`A session can have at most ${MAX_COURTS} courts.`);
        }

        const sortOrder = courts.length;
        const name = courtNameForIndex(sortOrder);
        const court: LocalCourt = {
          id: input.id,
          sessionId: input.sessionId,
          name,
          status: "open",
          sortOrder,
        };
        await db.courts.put(court);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "CREATE_COURT",
          entityType: "court",
          entityId: input.id,
          sessionId: input.sessionId,
          payload: {
            sessionId: input.sessionId,
            name,
            sortOrder,
            status: "open",
          },
          createdAt: new Date().toISOString(),
        });
        return court;
      }),
  });
}

export async function normalizeSessionCourtsIfNeeded(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    return;
  }

  const courts = await listSessionCourts(sessionId);
  const needsRepair = courts.some(
    (court, index) => court.name !== courtNameForIndex(index) || court.sortOrder !== index,
  );
  if (!needsRepair) {
    return;
  }

  await applyMutation({
    run: async () =>
      runInTransaction(async () => {
        await renumberSessionCourtsLocal(sessionId, session.organizationId);
      }),
  });
}

export async function deleteCourtLocal(input: {
  sessionId: string;
  courtId: string;
}): Promise<void> {
  return applyMutation({
    run: async () =>
      runInTransaction(async () => {
        const session = await requireSession(input.sessionId);
        const courts = await listSessionCourts(input.sessionId);
        if (courts.length <= MIN_COURTS) {
          throw new Error("At least one court is required.");
        }

        const court = await db.courts.get(input.courtId);
        if (!court || court.sessionId !== input.sessionId) {
          throw new Error("Court not found.");
        }

        const activeMatch = await db.matches
          .where("sessionId")
          .equals(input.sessionId)
          .filter(
            (match) =>
              match.courtId === input.courtId &&
              (match.status === "assigned" || match.status === "in_progress"),
          )
          .first();
        if (activeMatch) {
          throw new Error("Finish or cancel the match on this court before deleting it.");
        }

        const detachedMatches = await db.matches
          .where("sessionId")
          .equals(input.sessionId)
          .filter((match) => match.courtId === input.courtId)
          .toArray();
        for (const match of detachedMatches) {
          await db.matches.update(match.id, { courtId: null });
        }

        await db.courts.delete(input.courtId);
        await enqueueSyncAction({
          id: crypto.randomUUID(),
          organizationId: session.organizationId,
          type: "DELETE_COURT",
          entityType: "court",
          entityId: input.courtId,
          sessionId: input.sessionId,
          payload: {
            name: court.name,
            sortOrder: court.sortOrder,
            status: court.status,
          },
          createdAt: new Date().toISOString(),
        });
        await renumberSessionCourtsLocal(input.sessionId, session.organizationId);
      }),
  });
}
