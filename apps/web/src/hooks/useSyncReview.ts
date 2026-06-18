import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { OutboxAction } from "../db/types.js";
import { listReviewableOutboxActions } from "../sync/outbox.js";
import {
  describeSyncAction,
  type SyncActionDescription,
  type SyncActionLabelContext,
} from "../lib/sync-action-labels.js";

export interface ReviewableSyncAction {
  action: OutboxAction;
  description: SyncActionDescription;
}

export function useSyncReview(sessionId?: string) {
  const [actions, setActions] = useState<OutboxAction[]>([]);
  const [context, setContext] = useState<SyncActionLabelContext>({
    checkIns: new Map(),
    courts: new Map(),
    queueLanes: new Map(),
    queuedMatches: new Map(),
    matches: new Map(),
    playerProfiles: new Map(),
  });

  useEffect(() => {
    const sub = liveQuery(async () => {
      const reviewable = await listReviewableOutboxActions(sessionId);
      const sessionIds = sessionId
        ? [sessionId]
        : [...new Set(reviewable.map((row) => row.sessionId).filter(Boolean))];

      const [checkIns, courts, queueLanes, queuedMatches, matches, playerProfiles] =
        await Promise.all([
          sessionIds.length > 0
            ? (
                await Promise.all(sessionIds.map((id) => db.checkIns.where("sessionId").equals(id).toArray()))
              ).flat()
            : db.checkIns.toArray(),
          sessionIds.length > 0
            ? (
                await Promise.all(sessionIds.map((id) => db.courts.where("sessionId").equals(id).toArray()))
              ).flat()
            : db.courts.toArray(),
          sessionIds.length > 0
            ? (
                await Promise.all(
                  sessionIds.map((id) => db.queueLanes.where("sessionId").equals(id).toArray()),
                )
              ).flat()
            : db.queueLanes.toArray(),
          sessionIds.length > 0
            ? (
                await Promise.all(
                  sessionIds.map((id) => db.queuedMatches.where("sessionId").equals(id).toArray()),
                )
              ).flat()
            : db.queuedMatches.toArray(),
          sessionIds.length > 0
            ? (
                await Promise.all(sessionIds.map((id) => db.matches.where("sessionId").equals(id).toArray()))
              ).flat()
            : db.matches.toArray(),
          db.playerProfiles.toArray(),
        ]);

      return {
        reviewable,
        context: {
          checkIns: new Map(checkIns.map((row) => [row.id, row])),
          courts: new Map(courts.map((row) => [row.id, row])),
          queueLanes: new Map(queueLanes.map((row) => [row.id, row])),
          queuedMatches: new Map(queuedMatches.map((row) => [row.id, row])),
          matches: new Map(matches.map((row) => [row.id, row])),
          playerProfiles: new Map(playerProfiles.map((row) => [row.id, row])),
        } satisfies SyncActionLabelContext,
      };
    }).subscribe({
      next: (value) => {
        setActions(value.reviewable);
        setContext(value.context);
      },
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  const rows: ReviewableSyncAction[] = useMemo(
    () =>
      actions.map((action) => ({
        action,
        description: describeSyncAction(action, context),
      })),
    [actions, context],
  );

  return { actions, rows, context };
}
