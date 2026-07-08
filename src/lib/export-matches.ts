import type { MatchRecord, Player } from "@/types";

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

function escapeCsvField(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function buildMatchLogCsv(matches: MatchRecord[]): string {
  const headers = ["Date", "Time", "Court", "Match Type", "Side A", "Side B", "Result", "Status"];
  const rows = matches.map((match) => {
    const started = new Date(match.startedAt);
    return [
      started.toLocaleDateString("en-US"),
      started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      match.courtName,
      match.matchType === "DOUBLES" ? "Doubles" : "Singles",
      formatSide(match.sideA),
      formatSide(match.sideB),
      resultLabel(match),
      match.status,
    ];
  });
  return [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

export function downloadMatchLogCsv(matches: MatchRecord[]) {
  const csv = buildMatchLogCsv(matches);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `top-seed-session-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
