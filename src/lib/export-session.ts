import * as XLSX from "xlsx";
import type { MatchRecord, Player, SessionPlayerSnapshot } from "@/types";
import { computeLeaderboard } from "./leaderboard";
import { SKILL_LABELS } from "./utils";

function formatSide(players: Player[]): string {
  return players.map((p) => p.name.split(" ")[0]).join(" & ");
}

function resultLabel(match: MatchRecord): string {
  if (match.status === "VOIDED") return "Voided";
  if (match.result === "SIDE_A") return formatSide(match.sideA);
  if (match.result === "SIDE_B") return formatSide(match.sideB);
  if (match.result === "DRAW") return "Draw";
  return "—";
}

const GENDER_LABELS: Record<string, string> = { M: "Male", F: "Female" };
const PAYMENT_LABELS: Record<string, string> = { PAID: "Paid", UNPAID: "Unpaid", WAIVED: "Waived" };

function buildMatchesSheet(matches: MatchRecord[]) {
  const header = ["Date", "Time", "Court", "Match Type", "Side A", "Side B", "Result", "Status"];
  const rows = matches.map((match) => {
    const started = new Date(match.startedAt);
    return {
      Date: started.toLocaleDateString("en-US"),
      Time: started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      Court: match.courtName,
      "Match Type": match.matchType === "DOUBLES" ? "Doubles" : "Singles",
      "Side A": formatSide(match.sideA),
      "Side B": formatSide(match.sideB),
      Result: resultLabel(match),
      Status: match.status === "COMPLETED" ? "Completed" : "Voided",
    };
  });
  return XLSX.utils.json_to_sheet(rows, { header });
}

// Standings computed fresh from just this session's matches — consistent with
// "no cross-session aggregation" (see docs/specs/08-sessions.md), not the
// app's live all-time /leaderboard.
function buildLeaderboardSheet(
  sessionMatches: MatchRecord[],
  players: SessionPlayerSnapshot[]
) {
  const header = [
    "Rank",
    "Player",
    "Matches Played",
    "Wins",
    "Draws",
    "Losses",
    "Win Rate",
    "Result Points",
    "Bonus Points",
    "Points",
    "Form",
    "Longest Streak",
  ];
  // Ordered by Points, matching what the app itself shows. Points are
  // 3 a win + 1 a draw plus a bonus for beating stronger opposition; Form is
  // the shrunk win share used as the tiebreak. Result and bonus points are
  // split out so a reader can reconstruct the total rather than trust it.
  // Same check-in tiebreak the app applies, so the sheet's order can't differ
  // from what the organiser saw on screen.
  const checkInByPlayer = new Map(
    players.filter((p) => p.sessionJoinedAt).map((p) => [p.id, p.sessionJoinedAt!])
  );
  const standings = computeLeaderboard(sessionMatches, {
    matchType: "ALL",
    sort: "points",
    checkInByPlayer,
  });
  const rows = standings.map((row) => ({
    Rank: row.rank,
    Player: row.name,
    "Matches Played": row.matchesPlayed,
    Wins: row.wins,
    Draws: row.draws,
    Losses: row.losses,
    "Win Rate": `${Math.round(row.winRate * 100)}%`,
    "Result Points": row.resultPoints,
    "Bonus Points": row.bonusPoints,
    Points: row.points,
    Form: `${Math.round(row.form * 100)}%`,
    "Longest Streak": row.longestStreak,
  }));
  return XLSX.utils.json_to_sheet(rows, { header });
}

function buildPlayersSheet(players: SessionPlayerSnapshot[]) {
  const header = ["Name", "Skill", "Gender", "Payment Status", "Check-in"];
  const rows = players.map((p) => ({
    Name: p.name,
    Skill: SKILL_LABELS[p.skillLevel] ?? p.skillLevel,
    Gender: p.gender ? GENDER_LABELS[p.gender] : "—",
    "Payment Status": PAYMENT_LABELS[p.paymentStatus],
    // Absent on snapshots taken before this field was captured — not an error.
    "Check-in": p.sessionJoinedAt
      ? new Date(p.sessionJoinedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "—",
  }));
  return XLSX.utils.json_to_sheet(rows, { header });
}

export function buildSessionWorkbook(sessionMatches: MatchRecord[], players: SessionPlayerSnapshot[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildMatchesSheet(sessionMatches), "Matches");
  XLSX.utils.book_append_sheet(wb, buildLeaderboardSheet(sessionMatches, players), "Leaderboard");
  XLSX.utils.book_append_sheet(wb, buildPlayersSheet(players), "Players");
  return wb;
}

// Dated by the session's own start date, not today — exporting an old closed
// session shouldn't produce a file that looks like it was just created today.
export function downloadSessionWorkbook(
  sessionDate: string,
  sessionMatches: MatchRecord[],
  players: SessionPlayerSnapshot[]
) {
  const wb = buildSessionWorkbook(sessionMatches, players);
  const dateStr = new Date(sessionDate).toISOString().slice(0, 10);
  XLSX.writeFile(wb, `top-seed-session-${dateStr}.xlsx`);
}
