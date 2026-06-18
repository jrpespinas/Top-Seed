import { updatePlayerProfileLocal } from "./updatePlayerProfile.js";
import { clearDatabase, db } from "../db/database.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createPlayerLocal } from "./createPlayer.js";
import { listPendingOutboxActions } from "../sync/outbox.js";

describe("updatePlayerProfileLocal", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("updates profile and enqueues UPDATE_PLAYER_PROFILE", async () => {
    await createPlayerLocal({
      id: "player-1",
      organizationId: "org-default",
      displayName: "Alex",
      defaultSkillRating: 3,
    });

    await updatePlayerProfileLocal({
      playerProfileId: "player-1",
      organizationId: "org-default",
      displayName: "Alexandra",
      defaultSkillRating: 3.5,
      phone: "555-0100",
      gender: "female",
      notes: "Regular",
    });

    const profile = await db.playerProfiles.get("player-1");
    expect(profile?.displayName).toBe("Alexandra");
    expect(profile?.defaultSkillRating).toBe(3.5);

    const outbox = await listPendingOutboxActions();
    expect(outbox.some((action) => action.type === "UPDATE_PLAYER_PROFILE")).toBe(true);
  });
});
