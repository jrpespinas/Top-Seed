import { describe, expect, it } from "vitest";
import { buildSessionLeaderboardEntries } from "./leaderboard-snapshot.js";
import type { LocalCheckIn, LocalMatch, LocalPlayerProfile, LocalSession } from "../db/types.js";

const session: LocalSession = {
  id: "session-1",
  organizationId: "org-default",
  name: "Friday",
  venueName: "Hall",
  startsAt: "2026-06-09T18:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested",
  ratingMode: "casual",
};

const profiles: LocalPlayerProfile[] = [
  {
    id: "player-1",
    organizationId: "org-default",
    displayName: "Alex",
    defaultSkillRating: 3,
  },
  {
    id: "player-2",
    organizationId: "org-default",
    displayName: "Blair",
    defaultSkillRating: 3,
  },
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
  {
    id: "check-in-2",
    sessionId: "session-1",
    playerProfileId: "player-2",
    playerDisplayName: "Blair",
    arrivalOrder: 1,
    checkedInAt: "2026-06-09T18:05:00.000Z",
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

describe("leaderboard-snapshot", () => {
  it("builds session W-L-D and excludes cancelled matches", () => {
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
      {
        id: "match-2",
        sessionId: "session-1",
        courtId: "court-1",
        status: "cancelled",
        outcome: "cancelled",
        completedAt: "2026-06-09T19:30:00.000Z",
        participants: [
          { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one" },
          { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two" },
        ],
      },
    ];

    const entries = buildSessionLeaderboardEntries(session, matches, checkIns, profiles);
    const alex = entries.find((entry) => entry.playerProfileId === "player-1");
    const blair = entries.find((entry) => entry.playerProfileId === "player-2");

    expect(alex?.wins).toBe(1);
    expect(alex?.losses).toBe(0);
    expect(blair?.losses).toBe(1);
    expect(alex?.matchesPlayed).toBe(1);
    expect(alex?.winRate).toBe(1);
  });

  it("counts unscored as a game without win or loss", () => {
    const matches: LocalMatch[] = [
      {
        id: "match-3",
        sessionId: "session-1",
        courtId: "court-1",
        status: "completed",
        outcome: "unscored",
        winningTeam: null,
        completedAt: "2026-06-09T20:00:00.000Z",
        participants: [
          { checkInId: "check-in-1", playerProfileId: "player-1", team: "team_one" },
          { checkInId: "check-in-2", playerProfileId: "player-2", team: "team_two" },
        ],
      },
    ];

    const entries = buildSessionLeaderboardEntries(session, matches, checkIns, profiles);
    const alex = entries.find((entry) => entry.playerProfileId === "player-1");
    expect(alex?.matchesPlayed).toBe(1);
    expect(alex?.wins).toBe(0);
    expect(alex?.losses).toBe(0);
    expect(alex?.draws).toBe(0);
    expect(alex?.winRate).toBeNull();
  });
});
