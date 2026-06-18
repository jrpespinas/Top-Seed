import type { CheckIn, Match, SessionSnapshot } from "../types/index.js";
import { SUGGESTION_WEIGHTS } from "../constants.js";

export interface SuggestionPlayer {
  checkInId: string;
  playerProfileId: string;
  sessionSkillRating: number;
  arrivalOrder: number;
  matchesPlayedInSession: number;
  waitMinutes: number;
}

export interface SuggestionTeam {
  playerProfileIds: [string, string];
}

export interface SuggestionScoreBreakdown {
  waitPriority: number;
  teamBalance: number;
  arrivalFairness: number;
  repeatPenalty: number;
  restPenalty: number;
  total: number;
}

export interface MatchSuggestion {
  teamOne: SuggestionTeam;
  teamTwo: SuggestionTeam;
  players: SuggestionPlayer[];
  score: SuggestionScoreBreakdown;
}

function isOnActiveCourt(checkIn: CheckIn, matches: Match[]): boolean {
  return matches.some(
    (match) =>
      (match.status === "assigned" || match.status === "in_progress") &&
      match.participants.some((p) => p.checkInId === checkIn.id),
  );
}

function waitMinutes(checkIn: CheckIn, now: string): number {
  const checkedInMs = new Date(checkIn.checkedInAt).getTime();
  const nowMs = new Date(now).getTime();
  return Math.max(0, (nowMs - checkedInMs) / 60_000);
}

function restMinutes(checkIn: CheckIn, now: string): number {
  if (!checkIn.lastMatchEndedAt) {
    return 0;
  }
  const endedMs = new Date(checkIn.lastMatchEndedAt).getTime();
  const nowMs = new Date(now).getTime();
  return Math.max(0, (nowMs - endedMs) / 60_000);
}

export function buildSuggestionPool(snapshot: SessionSnapshot): CheckIn[] {
  const { checkIns, matches, session } = snapshot;

  if (session.queueMode === "manual") {
    return [];
  }

  const waiting = checkIns.filter(
    (c) =>
      c.queueStatus === "waiting" &&
      !c.suggestionExcluded &&
      !isOnActiveCourt(c, matches),
  );

  const stagedAssigned = checkIns.filter(
    (c) =>
      c.queueStatus === "assigned" &&
      !c.suggestionExcluded &&
      !isOnActiveCourt(c, matches),
  );

  if (waiting.length + stagedAssigned.length >= 4) {
    return [...waiting, ...stagedAssigned];
  }

  const resting = checkIns.filter(
    (c) =>
      c.queueStatus === "resting" &&
      !c.suggestionExcluded &&
      !isOnActiveCourt(c, matches),
  );

  return [...waiting, ...stagedAssigned, ...resting];
}

function recentPartnersAndOpponents(
  playerProfileId: string,
  matches: Match[],
): { partners: Set<string>; opponents: Set<string> } {
  const partners = new Set<string>();
  const opponents = new Set<string>();

  for (const match of matches) {
    if (match.status !== "completed" || match.outcome === "cancelled") {
      continue;
    }

    const playerParticipant = match.participants.find(
      (p) => p.playerProfileId === playerProfileId,
    );
    if (!playerParticipant) {
      continue;
    }

    const sameTeam = match.participants.filter(
      (p) => p.team === playerParticipant.team && p.playerProfileId !== playerProfileId,
    );
    const otherTeam = match.participants.filter((p) => p.team !== playerParticipant.team);

    for (const partner of sameTeam) {
      partners.add(partner.playerProfileId);
    }
    for (const opponent of otherTeam) {
      opponents.add(opponent.playerProfileId);
    }
  }

  return { partners, opponents };
}

function computeWaitPriority(players: SuggestionPlayer[]): number {
  return players.reduce((sum, player) => {
    const waitComponent = player.waitMinutes * SUGGESTION_WEIGHTS.waitTimePerMinute;
    const playedPenalty =
      player.matchesPlayedInSession * SUGGESTION_WEIGHTS.waitMatchesPlayedPenalty;
    return sum + waitComponent - playedPenalty;
  }, 0);
}

function computeTeamBalance(
  teamOne: SuggestionPlayer[],
  teamTwo: SuggestionPlayer[],
): number {
  const teamOneAvg =
    teamOne.reduce((sum, p) => sum + p.sessionSkillRating, 0) / teamOne.length;
  const teamTwoAvg =
    teamTwo.reduce((sum, p) => sum + p.sessionSkillRating, 0) / teamTwo.length;
  const diff = Math.abs(teamOneAvg - teamTwoAvg);
  return Math.max(0, SUGGESTION_WEIGHTS.teamBalanceMultiplier * (1 - diff));
}

function computeArrivalFairness(players: SuggestionPlayer[]): number {
  const orders = players.map((p) => p.arrivalOrder);
  const spread = Math.max(...orders) - Math.min(...orders);
  return SUGGESTION_WEIGHTS.arrivalFairnessMultiplier * (4 - spread);
}

function computeRepeatPenalty(
  teamOne: SuggestionPlayer[],
  teamTwo: SuggestionPlayer[],
  matches: Match[],
): number {
  let penalty = 0;
  const allPlayers = [...teamOne, ...teamTwo];

  for (let i = 0; i < teamOne.length; i++) {
    for (let j = i + 1; j < teamOne.length; j++) {
      const a = teamOne[i]!;
      const b = teamOne[j]!;
      const aRecent = recentPartnersAndOpponents(a.playerProfileId, matches);
      if (aRecent.partners.has(b.playerProfileId)) {
        penalty += SUGGESTION_WEIGHTS.repeatPartnerPenalty;
      }
    }
  }

  for (let i = 0; i < teamTwo.length; i++) {
    for (let j = i + 1; j < teamTwo.length; j++) {
      const a = teamTwo[i]!;
      const b = teamTwo[j]!;
      const aRecent = recentPartnersAndOpponents(a.playerProfileId, matches);
      if (aRecent.partners.has(b.playerProfileId)) {
        penalty += SUGGESTION_WEIGHTS.repeatPartnerPenalty;
      }
    }
  }

  for (const one of teamOne) {
    for (const two of teamTwo) {
      const oneRecent = recentPartnersAndOpponents(one.playerProfileId, matches);
      if (oneRecent.opponents.has(two.playerProfileId)) {
        penalty += SUGGESTION_WEIGHTS.repeatOpponentPenalty;
      }
    }
  }

  void allPlayers;
  return penalty;
}

function computeRestPenalty(players: SuggestionPlayer[], checkIns: CheckIn[], now: string): number {
  const checkInById = new Map(checkIns.map((c) => [c.id, c]));
  return players.reduce((sum, player) => {
    const checkIn = [...checkInById.values()].find(
      (c) => c.playerProfileId === player.playerProfileId,
    );
    if (!checkIn) {
      return sum;
    }
    const minutes = restMinutes(checkIn, now);
    if (minutes <= 5) {
      return sum + SUGGESTION_WEIGHTS.restPenaltyRecentMinutes;
    }
    return sum;
  }, 0);
}

function scoreCandidate(
  teamOne: SuggestionPlayer[],
  teamTwo: SuggestionPlayer[],
  matches: Match[],
  checkIns: CheckIn[],
  now: string,
): SuggestionScoreBreakdown {
  const players = [...teamOne, ...teamTwo];
  const waitPriority = computeWaitPriority(players);
  const teamBalance = computeTeamBalance(teamOne, teamTwo);
  const arrivalFairness = computeArrivalFairness(players);
  const repeatPenalty = computeRepeatPenalty(teamOne, teamTwo, matches);
  const restPenalty = computeRestPenalty(players, checkIns, now);

  const total = waitPriority + teamBalance + arrivalFairness - repeatPenalty - restPenalty;

  return {
    waitPriority,
    teamBalance,
    arrivalFairness,
    repeatPenalty,
    restPenalty,
    total,
  };
}

const TEAM_SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

function compareSuggestions(a: MatchSuggestion, b: MatchSuggestion): number {
  if (a.score.total !== b.score.total) {
    return b.score.total - a.score.total;
  }

  const maxWaitA = Math.max(...a.players.map((p) => p.waitMinutes));
  const maxWaitB = Math.max(...b.players.map((p) => p.waitMinutes));
  if (maxWaitA !== maxWaitB) {
    return maxWaitB - maxWaitA;
  }

  const minPlayedA = Math.min(...a.players.map((p) => p.matchesPlayedInSession));
  const minPlayedB = Math.min(...b.players.map((p) => p.matchesPlayedInSession));
  if (minPlayedA !== minPlayedB) {
    return minPlayedA - minPlayedB;
  }

  const minArrivalA = Math.min(...a.players.map((p) => p.arrivalOrder));
  const minArrivalB = Math.min(...b.players.map((p) => p.arrivalOrder));
  if (minArrivalA !== minArrivalB) {
    return minArrivalA - minArrivalB;
  }

  const idsA = a.players.map((p) => p.playerProfileId).sort().join(",");
  const idsB = b.players.map((p) => p.playerProfileId).sort().join(",");
  return idsA.localeCompare(idsB);
}

function combinationsOfFour<T>(items: T[]): T[][] {
  const result: T[][] = [];
  const n = items.length;
  for (let a = 0; a < n - 3; a++) {
    for (let b = a + 1; b < n - 2; b++) {
      for (let c = b + 1; c < n - 1; c++) {
        for (let d = c + 1; d < n; d++) {
          result.push([items[a]!, items[b]!, items[c]!, items[d]!]);
        }
      }
    }
  }
  return result;
}

function toSuggestionPlayer(checkIn: CheckIn, now: string): SuggestionPlayer {
  return {
    checkInId: checkIn.id,
    playerProfileId: checkIn.playerProfileId,
    sessionSkillRating: checkIn.sessionSkillRating,
    arrivalOrder: checkIn.arrivalOrder,
    matchesPlayedInSession: checkIn.matchesPlayedInSession,
    waitMinutes: waitMinutes(checkIn, now),
  };
}

export function buildSuggestion(snapshot: SessionSnapshot): MatchSuggestion | null {
  if (snapshot.session.queueMode === "manual") {
    return null;
  }

  const pool = buildSuggestionPool(snapshot);
  if (pool.length < 4) {
    return null;
  }

  const candidates: MatchSuggestion[] = [];

  for (const group of combinationsOfFour(pool)) {
    const suggestionPlayers = group.map((c) => toSuggestionPlayer(c, snapshot.now));

    for (const split of TEAM_SPLITS) {
      const teamOnePlayers = [suggestionPlayers[split[0]]!, suggestionPlayers[split[1]]!];
      const teamTwoPlayers = [suggestionPlayers[split[2]]!, suggestionPlayers[split[3]]!];
      const score = scoreCandidate(
        teamOnePlayers,
        teamTwoPlayers,
        snapshot.matches,
        snapshot.checkIns,
        snapshot.now,
      );

      candidates.push({
        teamOne: {
          playerProfileIds: [
            teamOnePlayers[0]!.playerProfileId,
            teamOnePlayers[1]!.playerProfileId,
          ],
        },
        teamTwo: {
          playerProfileIds: [
            teamTwoPlayers[0]!.playerProfileId,
            teamTwoPlayers[1]!.playerProfileId,
          ],
        },
        players: suggestionPlayers,
        score,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(compareSuggestions);
  return candidates[0] ?? null;
}

export function explainSuggestion(suggestion: MatchSuggestion): string {
  const reasons: string[] = [];

  if (suggestion.score.waitPriority > 0) {
    reasons.push("players who have waited longest");
  }
  if (suggestion.score.teamBalance > 0) {
    reasons.push("closely balanced teams");
  }
  if (suggestion.score.arrivalFairness > 0 && reasons.length < 2) {
    reasons.push("fair arrival order");
  }
  if (suggestion.score.repeatPenalty < 0) {
    reasons.push("fewer repeat partners");
  }
  if (suggestion.score.restPenalty < 0) {
    reasons.push("recent rest considered");
  }

  if (reasons.length === 0) {
    return "Best available doubles match from the waiting pool.";
  }

  if (reasons.length === 1) {
    return `Suggested because of ${reasons[0]}.`;
  }

  return `Suggested because of ${reasons[0]} and ${reasons[1]}.`;
}
