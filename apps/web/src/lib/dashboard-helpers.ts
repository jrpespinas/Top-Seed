import type { MatchSuggestion } from "@top-seed/domain";
import type { LocalQueuedMatchParticipant } from "../db/types.js";

export function suggestionToParticipants(
  suggestion: MatchSuggestion,
): LocalQueuedMatchParticipant[] {
  const checkInByProfile = new Map(
    suggestion.players.map((player) => [player.playerProfileId, player.checkInId]),
  );
  const [teamOneA, teamOneB] = suggestion.teamOne.playerProfileIds;
  const [teamTwoA, teamTwoB] = suggestion.teamTwo.playerProfileIds;

  return [
    {
      checkInId: checkInByProfile.get(teamOneA)!,
      playerProfileId: teamOneA,
      team: "team_one",
      slotOrder: 1,
    },
    {
      checkInId: checkInByProfile.get(teamOneB)!,
      playerProfileId: teamOneB,
      team: "team_one",
      slotOrder: 2,
    },
    {
      checkInId: checkInByProfile.get(teamTwoA)!,
      playerProfileId: teamTwoA,
      team: "team_two",
      slotOrder: 1,
    },
    {
      checkInId: checkInByProfile.get(teamTwoB)!,
      playerProfileId: teamTwoB,
      team: "team_two",
      slotOrder: 2,
    },
  ];
}

export function displayNameForCheckIn(
  checkInId: string,
  checkIns: { id: string; playerDisplayName: string }[],
): string {
  return checkIns.find((checkIn) => checkIn.id === checkInId)?.playerDisplayName ?? "Unknown";
}

export function openCourts(
  courts: { id: string; status: string; currentMatchId?: string | null }[],
  matches: { courtId: string; status: string }[],
): string[] {
  return courts
    .filter((court) => {
      if (court.status === "paused" || court.status === "unavailable") {
        return false;
      }
      const active = matches.some(
        (match) =>
          match.courtId === court.id &&
          (match.status === "assigned" || match.status === "in_progress"),
      );
      return !active && !court.currentMatchId;
    })
    .map((court) => court.id);
}
