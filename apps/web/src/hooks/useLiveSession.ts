import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../db/database.js";
import type { LocalCheckIn, LocalSession } from "../db/types.js";

export function useLiveSession(sessionId: string | undefined) {
  const [session, setSession] = useState<LocalSession | undefined>();
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setSession(undefined);
      setCheckIns([]);
      return;
    }

    const sessionSub = liveQuery(() => db.sessions.get(sessionId)).subscribe({
      next: (value) => setSession(value),
    });
    const checkInSub = liveQuery(() =>
      db.checkIns.where("sessionId").equals(sessionId).sortBy("arrivalOrder"),
    ).subscribe({
      next: (value) => setCheckIns(value),
    });

    return () => {
      sessionSub.unsubscribe();
      checkInSub.unsubscribe();
    };
  }, [sessionId]);

  return { session, checkIns };
}
