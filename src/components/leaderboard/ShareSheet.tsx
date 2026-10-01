import { cn } from "@/lib/utils";
import { formatDurationMs } from "@/lib/match-history";
import type { Honor, LeaderboardRow } from "@/lib/leaderboard";
import { AwardChip, RankTab, isPodium } from "./broadcast";

/** A4 at 96dpi. Fixed, so print geometry and capture geometry are the same. */
export const SHEET_WIDTH_PX = 794;

/** How many standings rows the on-screen sheet and the PNG carry. */
export const SHEET_VISIBLE_ROWS = 10;

export interface ShareSheetData {
  sessionName: string;
  sessionDate: string;
  rows: LeaderboardRow[];
  honors: Honor[];
  matchesPlayed: number;
  totalCourtTimeMs: number;
}

function formatSheetDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function record(row: LeaderboardRow): string {
  return `${row.wins}–${row.draws}–${row.losses}`;
}

/**
 * The printable / postable session sheet.
 *
 * Fixed at A4 width rather than fluid, which is the whole reason it can be two
 * artifacts at once: the print path lands edge-correct on A4 and Letter, and
 * `html-to-image` captures the same node at 2x for a chat-legible PNG. A
 * responsive layout would have to be tested at every width and would still
 * capture at whatever width the viewport happened to be.
 *
 * **Built from the same Broadcast pieces as the live page** (`RankTab`,
 * `AwardChip`, the slanted bars), so what people see posted is what the
 * organiser saw on screen. A sheet that doesn't look like the app it came
 * from was overruled once already, in favour of an expensive print.
 *
 * That has a hard dependency: browsers drop background colours when printing
 * unless told otherwise, so the print block in `globals.css` sets
 * `print-color-adjust: exact` on this subtree. Without it the filled champion
 * bar prints as bare paper with near-white text on it.
 *
 * `data-print-only` / `data-screen-only` split the two audiences within one
 * component (see the print rules in globals.css): the screen and the PNG show
 * the top ten, while the printed sheet continues onto a second page with the
 * full field. One layout, both jobs, no chance of the two drifting apart.
 */
export function ShareSheet({ data }: { data: ShareSheetData }) {
  const { rows, honors } = data;
  const podium = rows.slice(0, 3);
  const champions = podium.filter((r) => r.rank === 1);
  const runnersUp = podium.filter((r) => r.rank !== 1);
  const lead = champions[0];
  const championNames =
    champions.length <= 2
      ? champions.map((c) => c.name).join(" & ")
      : `${champions.length}-way tie`;

  const visible = rows.slice(0, SHEET_VISIBLE_ROWS);
  const remainder = rows.slice(SHEET_VISIBLE_ROWS);

  return (
    <div
      data-print-root
      style={{ width: SHEET_WIDTH_PX }}
      className="bg-white text-ink font-sans"
    >
      {/* Masthead. The session name leads; the small mark on the right is the
          slot a club logo will take when there is one. */}
      <header className="flex items-start justify-between gap-6 px-10 pt-10 pb-6">
        <div className="min-w-0">
          <h1 className="font-display italic font-extrabold uppercase text-[40px] leading-none text-navy-deep truncate">
            {data.sessionName}
          </h1>
          <p className="mt-2 text-[15px] text-muted">{formatSheetDate(data.sessionDate)}</p>
          <p className="mt-3 font-mono text-[13px] tabular-nums text-muted">
            {rows.length} players
            <span className="text-muted/40"> · </span>
            {data.matchesPlayed} matches
            {data.totalCourtTimeMs > 0 && (
              <>
                <span className="text-muted/40"> · </span>
                {formatDurationMs(data.totalCourtTimeMs)} on court
              </>
            )}
          </p>
        </div>
        <p className="flex-shrink-0 font-display font-bold text-[13px] tracking-[0.24em] text-primary">
          TOP SEED
        </p>
      </header>

      <section className="px-10 pb-6">
        <div className="bc-slant [--slant:24px] bg-primary text-bg flex items-stretch gap-4 pr-11">
          <RankTab rank={1} className="[--slant:12px] text-[48px] pl-5 pr-7" />
          <div className="min-w-0 py-4 self-center">
            <h2 className="font-display italic font-extrabold uppercase leading-none text-[34px] truncate">
              {championNames}
            </h2>
            <p className="font-display font-bold uppercase tracking-[0.06em] text-[13px] text-bg/75 mt-1.5">
              {record(lead)} · {Math.round(lead.form * 100)}% form
            </p>
          </div>
          <div className="ml-auto self-center text-right leading-none flex-shrink-0">
            <span className="font-display italic font-extrabold text-[48px] text-podium-gold tabular-nums">
              {lead.points}
            </span>
            <span className="block font-display font-bold text-[11px] tracking-[0.14em] text-bg/70 mt-0.5">
              PTS
            </span>
          </div>
        </div>

        {runnersUp.length > 0 && (
          // Stepped like the screen's podium: second stands above third.
          <div className="grid grid-cols-2 gap-2 mt-2 items-end">
            {runnersUp.map((row) => (
              <div
                key={row.playerId}
                className="bc-slant [--slant:16px] bg-primary-tint text-navy-deep flex items-stretch gap-3 pr-7"
              >
                <RankTab rank={row.rank} className="[--slant:10px] text-[26px] pl-3 pr-5" />
                <div className={cn("min-w-0 self-center", row.rank === 2 ? "py-3" : "py-2")}>
                  <p className="font-display italic font-extrabold uppercase leading-none text-[20px] truncate">
                    {row.name}
                  </p>
                  <p className="font-display font-bold uppercase tracking-[0.06em] text-[11px] text-muted mt-1">
                    {record(row)}
                  </p>
                </div>
                <span className="ml-auto self-center font-display italic font-extrabold text-[26px] tabular-nums leading-none">
                  {row.points}
                </span>
              </div>
            ))}
          </div>
        )}

        {honors.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-3">
            {honors.map((honor) => (
              <li key={honor.kind}>
                <AwardChip honor={honor} className="text-[13px]" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Standings — top ten on screen and in the PNG. */}
      <section className="px-10 pb-6">
        <StandingsTable rows={visible} />
        {remainder.length > 0 && (
          <p data-screen-only className="mt-2.5 text-[13px] text-muted">
            + {remainder.length} more {remainder.length === 1 ? "player" : "players"} — full
            standings on the printed sheet
          </p>
        )}
      </section>

      {/* The printed sheet carries everyone, continuing onto page two. The PNG
          never sees this: a chat thumbnail with sixty rows is unreadable, but a
          noticeboard sheet that omits fifty people is useless. */}
      {remainder.length > 0 && (
        <section data-print-only className="px-10 pb-6" style={{ breakBefore: "page" }}>
          <h3 className="text-[15px] font-semibold text-ink mb-3">
            Full standings, {SHEET_VISIBLE_ROWS + 1}–{rows.length}
          </h3>
          <StandingsTable rows={remainder} />
        </section>
      )}

      {/* This sheet gets posted to people who weren't looking over the
          organiser's shoulder. "Why is Mira above Karen" is the first reply in
          the thread; one line answers it before it's asked. */}
      <footer className="px-10 pb-10 pt-4">
        <div className="h-px bg-border mb-3" />
        <p className="text-[12px] leading-relaxed text-muted">
          3 points a win, 1 a draw, plus a point for each level beaten above your own. Ties go to
          form, where everyone starts the night 1–1.
        </p>
      </footer>
    </div>
  );
}

function StandingsTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted pb-1.5 w-[46px]">
            #
          </th>
          <th className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted pb-1.5">
            Player
          </th>
          <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted pb-1.5 w-[86px]">
            W–D–L
          </th>
          <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted pb-1.5 w-[60px]">
            Form
          </th>
          <th className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted pb-1.5 w-[56px]">
            Pts
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.playerId} className="border-b border-border/50">
            <td className="py-[7px]">
              {isPodium(row.rank) ? (
                <RankTab rank={row.rank} className="[--slant:5px] w-7 h-5 pr-1 text-[15px]" />
              ) : (
                <span className="font-mono text-[14px] tabular-nums text-muted">{row.rank}</span>
              )}
            </td>
            <td className="py-[7px] pr-3">
              <span className="text-[14px] text-ink truncate block max-w-[300px]">{row.name}</span>
            </td>
            <td className="py-[7px] text-right font-mono text-[14px] tabular-nums text-muted">
              {record(row)}
            </td>
            <td className="py-[7px] text-right font-mono text-[14px] tabular-nums text-muted">
              {Math.round(row.form * 100)}%
            </td>
            <td className="py-[7px] text-right font-mono text-[14px] font-bold tabular-nums text-ink">
              {row.points}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
