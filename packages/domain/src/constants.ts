/** Centralized suggestion scoring weights — tune here only. */
export const SUGGESTION_WEIGHTS = {
  waitTimePerMinute: 0.1,
  waitMatchesPlayedPenalty: 0.5,
  teamBalanceMultiplier: 2.0,
  repeatPartnerPenalty: 1.5,
  repeatOpponentPenalty: 0.75,
  restPenaltyRecentMinutes: 1.0,
  arrivalFairnessMultiplier: 0.25,
} as const;

export const RATING_LIMITS = {
  min: 1.0,
  max: 5.0,
} as const;

export const RATING_DELTAS = {
  evenWin: 0.05,
  favoredWin: 0.02,
  underdogWin: 0.1,
  drawMax: 0.03,
} as const;
