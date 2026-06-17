/**
 * Merge policy: server dashboard snapshots fill in synced server truth without
 * clobbering unsynced local edits. Rows with syncStatus pending/syncing/failed/local
 * always win over server check-in payloads.
 */
import type { CheckInDto } from "@top-seed/contracts";
import type { LocalCheckIn, SyncStatus } from "../db/types.js";

const PROTECTED_STATUSES: SyncStatus[] = ["local", "pending", "syncing", "failed"];

export function mergeCheckIns(
  localCheckIns: LocalCheckIn[],
  serverCheckIns: CheckInDto[],
): LocalCheckIn[] {
  const localById = new Map(localCheckIns.map((checkIn) => [checkIn.id, checkIn]));
  const merged: LocalCheckIn[] = [];
  const seen = new Set<string>();

  for (const server of serverCheckIns) {
    const local = localById.get(server.id);
    if (local && PROTECTED_STATUSES.includes(local.syncStatus)) {
      merged.push(local);
    } else {
      merged.push({
        id: server.id,
        sessionId: server.sessionId,
        playerProfileId: server.playerProfileId,
        playerDisplayName: server.playerDisplayName,
        arrivalOrder: server.arrivalOrder,
        checkedInAt: server.checkedInAt,
        queueStatus: server.queueStatus,
        sessionSkillRating: server.sessionSkillRating,
        paymentStatus: server.paymentStatus,
        paymentAmountDue: server.paymentAmountDue,
        paymentAmountPaid: server.paymentAmountPaid,
        paymentMethod: server.paymentMethod,
        paymentNotes: server.paymentNotes,
        syncStatus: "synced",
        lastSyncedAt: new Date().toISOString(),
      });
    }
    seen.add(server.id);
  }

  for (const local of localCheckIns) {
    if (!seen.has(local.id)) {
      merged.push(local);
    }
  }

  return merged.sort((a, b) => a.arrivalOrder - b.arrivalOrder);
}

export interface DashboardSnapshotLike {
  checkIns: CheckInDto[];
  sync?: { serverVersion?: number };
}

export function mergeSnapshot(
  localCheckIns: LocalCheckIn[],
  snapshot: DashboardSnapshotLike,
): { checkIns: LocalCheckIn[]; serverVersion?: number } {
  return {
    checkIns: mergeCheckIns(localCheckIns, snapshot.checkIns),
    serverVersion: snapshot.sync?.serverVersion,
  };
}
