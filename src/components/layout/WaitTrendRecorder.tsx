"use client";

import { useMemo } from "react";
import { useCurrentSession, useQueueSnapshot, useSessionArchive } from "@/lib/session-store";
import { useWaitTrendRecorder } from "@/lib/wait-trend";

/**
 * Renders nothing; samples the live queue's average wait once a minute.
 *
 * Mounted in AppShell rather than on `/players`, because that page is not
 * where an organiser spends a session — recording only while it was open would
 * leave the trend full of holes exactly when the queue was busiest. It can
 * only cover time the app is actually open; there is no background execution
 * here to lean on, and the chart says so.
 */
export function WaitTrendRecorder() {
  const currentSession = useCurrentSession();
  const archive = useSessionArchive();
  const queue = useQueueSnapshot();

  const knownSessionIds = useMemo(() => archive.map((s) => s.id), [archive]);

  useWaitTrendRecorder(currentSession?.id ?? null, queue, knownSessionIds);
  return null;
}
