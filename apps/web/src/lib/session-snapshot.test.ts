import { beforeEach, describe, expect, it } from "vitest";
import { clearDatabase } from "../db/database.js";
import { createSessionLocal } from "../mutations/createSession.js";
import { checkInPlayerLocal } from "../mutations/checkInPlayer.js";
import { buildSessionSnapshot } from "./session-snapshot.js";
import { buildSuggestion } from "@top-seed/domain";

describe("buildSessionSnapshot", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("maps dexie rows into a domain snapshot", async () => {
    await createSessionLocal({
      id: "session-1",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      feeAmount: 150,
    });

    for (let index = 0; index < 4; index += 1) {
      await checkInPlayerLocal({
        id: `check-in-${index}`,
        sessionId: "session-1",
        playerProfileId: `player-${index}`,
        playerDisplayName: `Player ${index}`,
        arrivalOrder: index,
        checkedInAt: `2026-06-09T18:0${index}:00.000Z`,
        sessionSkillRating: 3,
        paymentAmountDue: 150,
      });
    }

    const snapshot = await buildSessionSnapshot("session-1");
    expect(snapshot?.checkIns).toHaveLength(4);
    expect(snapshot?.courts.length).toBeGreaterThan(0);
    expect(buildSuggestion(snapshot!)).not.toBeNull();
  });
});
