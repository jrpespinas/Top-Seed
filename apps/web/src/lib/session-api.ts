import {
  checkInPlayerPayloadSchema,
  createDataEnvelopeSchema,
  createPlayerProfilePayloadSchema,
  createSessionRequestSchema,
  sessionDtoSchema,
  type SyncAction,
} from "@top-seed/contracts";
import type { CreateSessionRequest } from "@top-seed/contracts";
import { DEFAULT_ORG_ID, getDeviceId } from "./device.js";
import { postSyncActions } from "../sync/syncClient.js";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

const sessionResponseSchema = createDataEnvelopeSchema(sessionDtoSchema);

export async function createSessionOnServer(input: CreateSessionRequest) {
  const body = createSessionRequestSchema.parse(input);
  const response = await fetch(`${apiBaseUrl}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message ?? response.status)
        : `Create session failed with status ${response.status}`,
    );
  }
  return sessionResponseSchema.parse(json).data;
}

export async function startSessionOnServer(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message ?? response.status)
        : `Start session failed with status ${response.status}`,
    );
  }
  return sessionResponseSchema.parse(json).data;
}

export async function sessionExistsOnServer(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${sessionId}/dashboard`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureSessionOnServer(sessionId: string): Promise<void> {
  if (await sessionExistsOnServer(sessionId)) {
    await ensureSessionStructureOnServer(sessionId);
    return;
  }

  const { db } = await import("../db/database.js");
  const session = await db.sessions.get(sessionId);
  if (!session) {
    return;
  }

  const courtCount = await db.courts.where("sessionId").equals(sessionId).count();

  try {
    await createSessionOnServer({
      id: session.id,
      organizationId: session.organizationId,
      name: session.name,
      venueName: session.venueName,
      startsAt: session.startsAt,
      feeAmount: session.feeAmount,
      currency: session.currency,
      queueMode: session.queueMode,
      ratingMode: session.ratingMode,
      courtCount: Math.max(courtCount, 2),
    });
  } catch (error) {
    if (!(await sessionExistsOnServer(sessionId))) {
      throw error;
    }
  }

  if (session.status === "active") {
    try {
      await startSessionOnServer(sessionId);
    } catch (error) {
      if (!(await sessionExistsOnServer(sessionId))) {
        throw error;
      }
    }
  }

  await ensureSessionStructureOnServer(sessionId);
}

async function fetchServerEntityIds(
  sessionId: string,
): Promise<{
  courtIds: Set<string>;
  laneIds: Set<string>;
  checkInIds: Set<string>;
  checkedInPlayerProfileIds: Set<string>;
} | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${sessionId}/dashboard`);
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as {
      data?: {
        courts?: { id: string }[];
        checkIns?: { id: string; playerProfileId: string }[];
        queue?: { lanes?: { id: string }[] };
      };
    };
    const data = json.data;
    if (!data) {
      return null;
    }
    return {
      courtIds: new Set((data.courts ?? []).map((court) => court.id)),
      laneIds: new Set((data.queue?.lanes ?? []).map((lane) => lane.id)),
      checkInIds: new Set((data.checkIns ?? []).map((checkIn) => checkIn.id)),
      checkedInPlayerProfileIds: new Set(
        (data.checkIns ?? []).map((checkIn) => checkIn.playerProfileId),
      ),
    };
  } catch {
    return null;
  }
}

export async function ensureSessionStructureOnServer(sessionId: string): Promise<void> {
  const serverIds = await fetchServerEntityIds(sessionId);
  if (!serverIds) {
    return;
  }

  const { db } = await import("../db/database.js");
  const session = await db.sessions.get(sessionId);
  if (!session) {
    return;
  }

  const [localCourts, localLanes, localCheckIns] = await Promise.all([
    db.courts.where("sessionId").equals(sessionId).sortBy("sortOrder"),
    (async () => {
      const lanes = await db.queueLanes.where("sessionId").equals(sessionId).sortBy("sortOrder");
      return lanes.filter((lane) => lane.status !== "deleted");
    })(),
    db.checkIns.where("sessionId").equals(sessionId).sortBy("arrivalOrder"),
  ]);

  const bootstrapActions: SyncAction[] = [];
  const now = new Date().toISOString();
  const organizationId = session.organizationId || DEFAULT_ORG_ID;

  const missingCheckIns = localCheckIns.filter(
    (checkIn) =>
      checkIn.queueStatus !== "removed" &&
      !serverIds.checkInIds.has(checkIn.id) &&
      !serverIds.checkedInPlayerProfileIds.has(checkIn.playerProfileId),
  );
  const profileIdsForMissingCheckIns = new Set(
    missingCheckIns.map((checkIn) => checkIn.playerProfileId),
  );

  for (const profileId of profileIdsForMissingCheckIns) {
    const profile = await db.playerProfiles.get(profileId);
    if (!profile) {
      continue;
    }
    bootstrapActions.push({
      id: crypto.randomUUID(),
      type: "CREATE_PLAYER_PROFILE",
      entityType: "playerProfile",
      entityId: profile.id,
      sessionId: "",
      payload: createPlayerProfilePayloadSchema.parse({
        organizationId: profile.organizationId || organizationId,
        displayName: profile.displayName,
        defaultSkillRating: profile.defaultSkillRating,
        phone: profile.phone,
        gender: profile.gender,
        notes: profile.notes,
        isActive: true,
      }),
      createdAt: now,
    });
  }

  for (const checkIn of missingCheckIns) {
    bootstrapActions.push({
      id: crypto.randomUUID(),
      type: "CHECK_IN_PLAYER",
      entityType: "checkIn",
      entityId: checkIn.id,
      sessionId,
      payload: checkInPlayerPayloadSchema.parse({
        sessionId,
        playerProfileId: checkIn.playerProfileId,
        arrivalOrder: checkIn.arrivalOrder,
        checkedInAt: checkIn.checkedInAt,
        sessionSkillRating: checkIn.sessionSkillRating,
        paymentStatus: checkIn.paymentStatus,
        paymentAmountDue: checkIn.paymentAmountDue,
        paymentAmountPaid: checkIn.paymentAmountPaid,
        paymentMethod: checkIn.paymentMethod,
        paymentNotes: checkIn.paymentNotes,
      }),
      createdAt: checkIn.checkedInAt,
    });
  }

  for (const court of localCourts) {
    if (serverIds.courtIds.has(court.id)) {
      continue;
    }
    bootstrapActions.push({
      id: crypto.randomUUID(),
      type: "CREATE_COURT",
      entityType: "court",
      entityId: court.id,
      sessionId,
      payload: {
        sessionId,
        name: court.name,
        sortOrder: court.sortOrder,
        status: court.status,
      },
      createdAt: now,
    });
  }

  for (const lane of localLanes) {
    if (serverIds.laneIds.has(lane.id)) {
      continue;
    }
    bootstrapActions.push({
      id: crypto.randomUUID(),
      type: "CREATE_QUEUE_LANE",
      entityType: "queueLane",
      entityId: lane.id,
      sessionId,
      payload: {
        sessionId,
        name: lane.name,
        sortOrder: lane.sortOrder,
      },
      createdAt: now,
    });
  }

  if (bootstrapActions.length === 0) {
    return;
  }

  await postSyncActions({
    organizationId,
    deviceId: getDeviceId(),
    actions: bootstrapActions,
  });
}
