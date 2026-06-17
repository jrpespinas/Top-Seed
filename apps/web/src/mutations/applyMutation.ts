import { db } from "../db/database.js";

export interface ApplyMutationOptions<T> {
  /** Dexie writes + outbox enqueue inside one transaction. */
  run: () => Promise<T>;
  /** Called after durable write succeeds (e.g. trigger sync). */
  afterCommit?: (result: T) => void | Promise<void>;
}

export async function applyMutation<T>(options: ApplyMutationOptions<T>): Promise<T> {
  const result = await options.run();
  if (options.afterCommit) {
    await options.afterCommit(result);
  }
  return result;
}

export async function runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction(
    "rw",
    [
      db.sessions,
      db.playerProfiles,
      db.checkIns,
      db.courts,
      db.queueLanes,
      db.queuedMatches,
      db.matches,
      db.syncOutbox,
    ],
    fn,
  );
}
