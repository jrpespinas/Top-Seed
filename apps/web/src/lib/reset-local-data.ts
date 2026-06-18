import { clearDatabase } from "../db/database.js";

/**
 * Wipes all organizer data stored in this browser (IndexedDB).
 * Does not delete server-side PostgreSQL rows.
 */
export async function resetAllLocalData(): Promise<void> {
  await clearDatabase();
}
