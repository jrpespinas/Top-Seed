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
function buildLeaderboardSheet(sessionMatches: MatchRecord[]) {
  const header = ["Rank", "Player", "Matches Played", "Wins", "Draws", "Losses", "Win Rate", "Rating"];
  // Sorted by Rating (a Wilson score lower bound, not naive Win Rate) — same
  // rationale as the live /leaderboard: a 1-1 record shouldn't outrank a
  // genuine multi-match record just because both compute to 100%. Keeping
  // this sheet's order consistent with what the app itself shows.
  const standings = computeLeaderboard(sessionMatches, { matchType: "ALL", sort: "rating" });
  const rows = standings.map((row) => ({
    Rank: row.isTied ? `T-${row.rank}` : row.rank,
    Player: row.name,
    "Matches Played": row.matchesPlayed,
    Wins: row.wins,
    Draws: row.draws,
    Losses: row.losses,
    "Win Rate": `${Math.round(row.winRate * 100)}%`,
    Rating: `${Math.round(row.rating * 100)}%`,
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
  XLSX.utils.book_append_sheet(wb, buildLeaderboardSheet(sessionMatches), "Leaderboard");
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
