export type QueueStatus = "waiting" | "assigned" | "playing" | "resting" | "done" | "removed";

export type QueuedMatchStatus = "draft" | "ready" | "promoted" | "removed";

export type MatchStatus = "assigned" | "in_progress" | "completed" | "cancelled";

export type CourtStatus = "open" | "occupied" | "paused" | "unavailable";

export type SessionStatus = "draft" | "open" | "active" | "completed" | "cancelled";

export type QueueMode = "suggested" | "manual";

export type RatingMode = "casual" | "rated";

export type MatchOutcome = "team_one_win" | "team_two_win" | "draw" | "unscored" | "cancelled";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "waived" | "refunded";

export type WinningTeam = "team_one" | "team_two";

export type DomainErrorCode =
  | "SESSION_NOT_ACTIVE"
  | "PLAYER_IS_PLAYING"
  | "COURT_ALREADY_OCCUPIED"
  | "COURT_NOT_OPEN"
  | "QUEUED_MATCH_NOT_READY"
  | "QUEUED_MATCH_INCOMPLETE"
  | "MATCH_NOT_IN_PROGRESS"
  | "MATCH_NOT_COMPLETED"
  | "QUEUE_LANE_REQUIRED"
  | "INVALID_PAYMENT_TRANSITION"
  | "PAYMENT_AMOUNT_INVALID"
  | "VALIDATION_ERROR";

export type DomainResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: DomainErrorCode; message: string };

export function ok<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

export function err<T>(code: DomainErrorCode, message: string): DomainResult<T> {
  return { ok: false, code, message };
}

export interface CheckIn {
  id: string;
  playerProfileId: string;
  queueStatus: QueueStatus;
  sessionSkillRating: number;
  arrivalOrder: number;
  checkedInAt: string;
  matchesPlayedInSession: number;
  lastMatchEndedAt: string | null;
  suggestionExcluded?: boolean;
  paymentStatus: PaymentStatus;
  paymentAmountDue: number;
  paymentAmountPaid: number;
}

export interface QueuedMatchParticipant {
  checkInId: string;
  playerProfileId: string;
}

export interface QueuedMatch {
  id: string;
  laneId: string;
  status: QueuedMatchStatus;
  participants: QueuedMatchParticipant[];
}

export interface QueueLane {
  id: string;
  isActive: boolean;
}

export interface MatchParticipant {
  checkInId: string;
  playerProfileId: string;
  team: "team_one" | "team_two";
}

export interface Match {
  id: string;
  courtId: string;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  winningTeam: WinningTeam | null;
  startedAt: string | null;
  endedAt: string | null;
  participants: MatchParticipant[];
  completedAt: string | null;
}

export interface Court {
  id: string;
  status: CourtStatus;
  currentMatchId: string | null;
}

export interface SessionContext {
  id: string;
  status: SessionStatus;
  queueMode: QueueMode;
  ratingMode: RatingMode;
}

export interface SessionSnapshot {
  session: SessionContext;
  checkIns: CheckIn[];
  queuedMatches: QueuedMatch[];
  matches: Match[];
  courts: Court[];
  now: string;
}

export interface PlayerStats {
  playerProfileId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PaymentCheckIn {
  id: string;
  paymentStatus: PaymentStatus;
  paymentAmountDue: number;
  paymentAmountPaid: number;
}

export interface PaymentSummary {
  expectedTotal: number;
  collectedTotal: number;
  unpaidTotal: number;
  waivedTotal: number;
  refundedTotal: number;
  countsByStatus: Record<PaymentStatus, number>;
  currency: string;
}
