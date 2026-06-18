import { describe, expect, it } from "vitest";
import { filterHistoryMatches } from "./useSessionHistory.js";
import type { LocalMatch } from "../db/types.js";

const baseMatch: LocalMatch = {
  id: "match-1",
  sessionId: "session-1",
  courtId: "court-1",
  status: "completed",
  outcome: "team_one_win",
  winningTeam: "team_one",
  participants: [],
};

describe("filterHistoryMatches", () => {
  it("filters draws and cancelled", () => {
    const matches: LocalMatch[] = [
      baseMatch,
      { ...baseMatch, id: "match-2", outcome: "draw", winningTeam: null },
      { ...baseMatch, id: "match-3", status: "cancelled", outcome: "cancelled" },
    ];

    expect(filterHistoryMatches(matches, "draws")).toHaveLength(1);
    expect(filterHistoryMatches(matches, "cancelled")).toHaveLength(1);
    expect(filterHistoryMatches(matches, "wins_losses")).toHaveLength(1);
  });
});
