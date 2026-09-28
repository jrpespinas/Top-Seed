import { cn, SKILL_LABELS_SHORT } from "@/lib/utils";
import { formatDurationMs } from "@/lib/match-history";
import { championSummary, type Honor, type LeaderboardRow } from "@/lib/leaderboard";
import { Medal, AwardStar, hasMedal } from "./medals";

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
 * **Carries the same palette as the live apex**, deliberately: filled
 * `bg-primary` champion, `bg-primary-tint` runners-up, `bg-primary-tint-soft`
 * awards. It was built white-on-blue-rules first, to spare a gym printer's
 * cartridge, and that was overruled — a sheet that doesn't look like the app
 * it came from is a worse outcome than an expensive print, and the image is
 * the artifact people actually see.
 *
 * That decision has a hard dependency: browsers drop background colours when
 * printing unless told otherwise, so the print block in `globals.css` sets
 * `print-color-adjust: exact` on this subtree. Without it the filled champion
 * prints as bare paper with near-white text on it — invisible, and worse than
 * never having filled it at all.
 *
 * The live numeral's glow is deliberately absent here. A text-shadow prints as
 * a grey smudge and captures as one too.
 *
 * `data-print-only` / `data-screen-only` split the two audiences within one
 * component (see the print rules in globals.css): the screen and the PNG show
 * the top ten, while the printed sheet continues onto a second page with the
 * full field. One layout, both jobs, no chance of the two drifting apart.
 */
export function ShareSheet({ data }: { data: ShareSheetData }) {
  const { rows, honors } = data;
  const podium = rows.slice(0, 3);
  const podiumIds = new Set(podium.map((r) => r.playerId));
  const champions = podium.filter((r) => r.rank === 1);
  const runnersUp = podium.filter((r) => r.rank !== 1);
  const honorByPlayer = new Map(honors.map((h) => [h.playerId, h]));
  const standaloneHonors = honors.filter((h) => !podiumIds.has(h.playerId));

  const lead = champions[0];
  const championHonor = champions.length === 1 ? honorByPlayer.get(lead.playerId) ?? null : null;
  const summary =
    champions.length === 1
      ? championSummary(lead, {
          suppressUpset: championHonor?.kind === "upset",
          suppressStreak: championHonor?.kind === "streak",
        })
      : null;
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
          <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight text-ink truncate">
            {data.sessionName}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted">{formatSheetDate(data.sessionDate)}</p>
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
        <div className="flex-shrink-0 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Top Seed
          </p>
        </div>
      </header>

      <div className="h-px bg-primary/25 mx-10" />

      {/* Champion — filled, matching the screen's apex. The glow on the live
          numeral is deliberately absent: a text-shadow prints as a grey smudge
          and captures as one too. */}
      <section className="px-10 pt-7 pb-6">
        <div className="rounded-lg bg-primary text-bg px-6 py-5">
          <div className="flex items-baseline gap-4">
            <Medal rank={1} className="text-[44px]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[30px] leading-[1.1] font-bold tracking-tight truncate">
                {championNames}
              </h2>
              <p className="mt-1.5 font-mono text-[15px] tabular-nums text-bg/80">
                <span className="text-[19px] font-bold text-bg">{lead.points}</span> pts
                <span className="text-bg/40"> · </span>
                {record(lead)}
                <span className="text-bg/40"> · </span>
                {Math.round(lead.form * 100)}% form
              </p>
            </div>
            {champions.length === 1 && (
              <span className="flex-shrink-0 font-mono text-[12px] font-semibold text-bg/80 border border-bg/30 rounded px-1.5 py-0.5">
                {SKILL_LABELS_SHORT[lead.skillLevel]}
              </span>
            )}
          </div>
          {summary && <p className="mt-2.5 text-[15px] text-bg/80">{summary}</p>}
          {championHonor && (
            <div className="mt-3">
              <SheetAward honor={championHonor} onBrand />
            </div>
          )}
        </div>
      </section>

      {/* Runners-up */}
      {runnersUp.length > 0 && (
        <section className="px-10 pb-7 grid grid-cols-2 gap-4 items-end">
          {runnersUp.map((row) => {
            const honor = honorByPlayer.get(row.playerId);
            // Stepped like the screen's podium: second stands above third.
            const isSecond = row.rank === 2;
            return (
              <div
                key={row.playerId}
                className={cn(
                  "bg-primary-tint border border-primary/20 rounded-lg",
                  isSecond ? "px-4 py-5" : "px-4 py-3"
                )}
              >
                <div className="flex items-baseline gap-2.5">
                  {hasMedal(row.rank) ? (
                    <Medal rank={row.rank} className={isSecond ? "text-[28px]" : "text-[22px]"} />
                  ) : (
                    <span className="font-mono leading-none font-bold text-primary/40 tabular-nums text-[20px]">
                      {row.rank}
                    </span>
                  )}
                  <span className="text-[17px] font-semibold text-ink truncate flex-1 min-w-0">
                    {row.name}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[13px] tabular-nums text-muted">
                  <span className="font-bold text-ink">{row.points}</span> pts
                  <span className="text-muted/40"> · </span>
                  {record(row)}
                </p>
                {honor && (
                  <div className="mt-2">
                    <SheetAward honor={honor} compact />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Awards won from outside the top three */}
      {standaloneHonors.length > 0 && (
        <section className="px-10 pb-7 flex flex-col gap-2">
          {standaloneHonors.map((honor) => (
            <div
              key={honor.kind}
              className="flex items-center gap-3 bg-primary-tint-soft border border-primary/15 rounded-lg px-4 py-2.5"
            >
              <SheetAward honor={honor} />
              <span className="text-[15px] font-semibold text-ink flex-shrink-0">{honor.name}</span>
              <span className="text-[13px] text-muted truncate">{honor.detail}</span>
            </div>
          ))}
        </section>
      )}

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
              {hasMedal(row.rank) ? (
                <Medal rank={row.rank} className="text-[16px]" />
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

function SheetAward({
  honor,
  compact = false,
  onBrand = false,
}: {
  honor: Honor;
  compact?: boolean;
  /** Riding the champion's filled ground rather than a light tint. */
  onBrand?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded font-semibold",
        onBrand
          ? "bg-bg/15 text-bg"
          : "border border-primary/20 bg-surface text-primary",
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]"
      )}
    >
      <AwardStar className={compact ? "text-[11px]" : "text-[13px]"} />
      {honor.label}
    </span>
  );
}
