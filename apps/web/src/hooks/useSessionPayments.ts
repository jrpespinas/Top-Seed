import { useEffect, useMemo, useState } from "react";
import { liveQuery } from "dexie";
import { computePaymentSummary, type PaymentCheckIn } from "@top-seed/domain";
import { db } from "../db/database.js";
import type { LocalCheckIn, LocalSession } from "../db/types.js";
import { getSessionMode } from "../lib/session-mode.js";
import { sortCheckInsForPayments } from "../lib/payment-actions.js";

export function useSessionPayments(sessionId: string) {
  const [session, setSession] = useState<LocalSession | undefined>();
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const [sessionRow, rows] = await Promise.all([
        db.sessions.get(sessionId),
        db.checkIns.where("sessionId").equals(sessionId).toArray(),
      ]);
      return { session: sessionRow, checkIns: rows };
    }).subscribe({
      next: (value) => {
        setSession(value.session);
        setCheckIns(value.checkIns);
      },
    });
    return () => sub.unsubscribe();
  }, [sessionId]);

  const sessionMode = session ? getSessionMode(session.status) : "ended";
  const summary = useMemo(() => {
    if (!session) {
      return null;
    }
    return computePaymentSummary(checkIns as PaymentCheckIn[], session.feeAmount, session.currency);
  }, [checkIns, session]);

  const sortedCheckIns = useMemo(() => [...checkIns].sort(sortCheckInsForPayments), [checkIns]);

  return { session, checkIns: sortedCheckIns, summary, sessionMode };
}
