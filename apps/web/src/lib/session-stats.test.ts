import { describe, expect, it } from "vitest";
import { computeSessionPlayerStats } from "./session-stats.js";
import type { LocalCheckIn, LocalMatch, LocalPlayerProfile, LocalSession } from "../db/types.js";

const session: LocalSession = {
  id: "session-1",
  organizationId: "org-default",
  name: "Night",
  venueName: "Hall",
  startsAt: "2026-06-09T18:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested",
  ratingMode: "casual",
};

const profiles: LocalPlayerProfile[] = [
  { id: "player-1", organizationId: "org-default", displayName: "Alex", defaultSkillRating: 3 },
  { id: "player-2", organizationId: "org-default", displayName: "Blair", defaultSkillRating: 3 },
];

const checkIns: LocalCheckIn[] = [
  {
    id: "check-in-1",
    sessionId: "session-1",
    playerProfileId: "player-1",
    playerDisplayName: "Alex",
    arrivalOrder: 0,
    checkedInAt: "2026-06-09T18:00:00.000Z",
    queueStatus: "waiting",
    sessionSkillRating: 3,
    paymentStatus: "unpaid",
    paymentAmountDue: 150,
    paymentAmountPaid: 0,
    paymentMethod: "none",
    paymentNotes: "",
    syncStatus: "local",
  },
];

describe("session-stats", () => {
  it("computes per-player W-L-D for a session", () => {
    const matches: LocalMatch[] = [
      {
        id: "match-1",
        sessionId: "session-1",
        courtId: "court-1",
        status: "completed",
        outcome: "team_one_win",
        winningTeam: "team_one",
        completedAt: "2026-06-09T19:00:00.000Z",
        participants: [
          { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one" },
          { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two" },
        ],
      },
    ];

    const stats = computeSessionPlayerStats("session-1", matches, checkIns, profiles, "casual");
    expect(stats.get("player-1")?.wins).toBe(1);
    expect(stats.get("player-1")?.winRate).toBe(1);
  });
});
