import { RATING_DELTAS, RATING_LIMITS } from "../constants.js";
import type { MatchOutcome, RatingMode, WinningTeam } from "../types/index.js";

export function clampRating(rating: number): number {
  return Math.min(RATING_LIMITS.max, Math.max(RATING_LIMITS.min, rating));
}

export interface TeamRatingInput {
  teamOneRatings: number[];
  teamTwoRatings: number[];
}

function teamAverage(ratings: number[]): number {
  if (ratings.length === 0) {
    return RATING_LIMITS.min;
  }
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

function winLossDelta(favoriteMargin: number): number {
  const absMargin = Math.abs(favoriteMargin);
  if (absMargin < 0.05) {
    return RATING_DELTAS.evenWin;
  }
  if (favoriteMargin > 0) {
    return RATING_DELTAS.favoredWin;
  }
  return RATING_DELTAS.underdogWin;
}

export interface RatingDeltaResult {
  teamOneDeltas: number[];
  teamTwoDeltas: number[];
}

export function computeWinLossRatingDeltas(
  input: TeamRatingInput,
  winningTeam: WinningTeam,
): RatingDeltaResult {
  const teamOneAvg = teamAverage(input.teamOneRatings);
  const teamTwoAvg = teamAverage(input.teamTwoRatings);
  const favoriteMargin = teamOneAvg - teamTwoAvg;
  const magnitude = winLossDelta(favoriteMargin);

  if (winningTeam === "team_one") {
    return {
      teamOneDeltas: input.teamOneRatings.map(() => magnitude),
      teamTwoDeltas: input.teamTwoRatings.map(() => -magnitude),
    };
  }

  return {
    teamOneDeltas: input.teamOneRatings.map(() => -magnitude),
    teamTwoDeltas: input.teamTwoRatings.map(() => magnitude),
  };
}

export function computeDrawRatingDeltas(input: TeamRatingInput): RatingDeltaResult {
  const teamOneAvg = teamAverage(input.teamOneRatings);
  const teamTwoAvg = teamAverage(input.teamTwoRatings);
  const margin = teamOneAvg - teamTwoAvg;

  if (Math.abs(margin) < 0.05) {
    return {
      teamOneDeltas: input.teamOneRatings.map(() => 0),
      teamTwoDeltas: input.teamTwoRatings.map(() => 0),
    };
  }

  const rawShift = Math.min(RATING_DELTAS.drawMax, Math.abs(margin) * 0.1);
  if (margin < 0) {
    return {
      teamOneDeltas: input.teamOneRatings.map(() => rawShift),
      teamTwoDeltas: input.teamTwoRatings.map(() => -rawShift),
    };
  }

  return {
    teamOneDeltas: input.teamOneRatings.map(() => -rawShift),
    teamTwoDeltas: input.teamTwoRatings.map(() => rawShift),
  };
}

export function shouldApplyRatingChanges(
  ratingMode: RatingMode,
  outcome: MatchOutcome,
): boolean {
  if (ratingMode !== "rated") {
    return false;
  }
  return (
    outcome === "team_one_win" || outcome === "team_two_win" || outcome === "draw"
  );
}

export function applyRatingDelta(before: number, delta: number): number {
  return clampRating(before + delta);
}

export function computeMatchRatingDeltas(
  ratingMode: RatingMode,
  outcome: MatchOutcome,
  input: TeamRatingInput,
  winningTeam: WinningTeam | null,
): RatingDeltaResult | null {
  if (!shouldApplyRatingChanges(ratingMode, outcome)) {
    return null;
  }

  if (outcome === "draw") {
    return computeDrawRatingDeltas(input);
  }

  if (
    (outcome === "team_one_win" || outcome === "team_two_win") &&
    winningTeam !== null
  ) {
    return computeWinLossRatingDeltas(input, winningTeam);
  }

  return null;
}
