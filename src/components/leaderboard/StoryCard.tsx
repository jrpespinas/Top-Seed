import type { LeaderboardRow } from "@/lib/leaderboard";
import type { ShareSheetData } from "./ShareSheet";
import { AwardChip, RankTab } from "./broadcast";

/**
 * Laid out at a third of Instagram's story size and captured at 3x, so the
 * download is exactly 1080 × 1920 while the layout is written in sizes that
 * are easy to reason about.
 */
export const STORY_WIDTH_PX = 360;
export const STORY_HEIGHT_PX = 640;
export const STORY_CAPTURE_SCALE = 3;

/**
 * Instagram draws its own profile bar over the top of a story and the reply
 * box over the bottom. Names, ranks and points stay between these lines;
 * only background sits under the platform's UI.
 */
const SAFE_TOP_PX = Math.round(STORY_HEIGHT_PX * 0.13);
const SAFE_BOTTOM_PX = Math.round(STORY_HEIGHT_PX * 0.18);

/**
 * Places shown after the champion. Five fit beside two award tags; each award
 * past that takes about one row's height, so it costs one row, but the podium
 * itself is never dropped.
 */
function rowsFor(honorCount: number): number {
  return Math.max(2, 5 - Math.max(0, honorCount - 2));
}

function record(row: LeaderboardRow): string {
  return `${row.wins}–${row.draws}–${row.losses}`;
}

function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

/**
 * The session result as an Instagram story, in the Broadcast style.
 *
 * Deliberately not a resized print sheet. A story is read as a phone-sized
 * thumbnail in a feed, so it carries the podium and the next few places at a
 * size that reads at a glance, plus the awards. The full standings stay on
 * the printed sheet.
 */
export function StoryCard({ data }: { data: ShareSheetData }) {
  const { rows, honors } = data;
  const champions = rows.filter((r) => r.rank === 1);
  const lead = champions[0] ?? rows[0];
  const championNames =
    champions.length <= 2
      ? champions.map((c) => c.name).join(" & ")
      : `${champions.length}-way tie`;
  const following = rows.filter((r) => r.rank !== 1).slice(0, rowsFor(honors.length));

  return (
    <div
      style={{ width: STORY_WIDTH_PX, height: STORY_HEIGHT_PX }}
      className="relative overflow-hidden bg-navy-deep text-bg font-display"
    >
      {/* Broadcast texture: faint diagonal pinstripes across the whole frame. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, oklch(1 0 0 / 0.045) 0 2px, transparent 2px 28px)",
        }}
      />

      <div
        className="absolute inset-x-0 flex flex-col gap-2 px-[22px]"
        style={{ top: SAFE_TOP_PX, bottom: SAFE_BOTTOM_PX }}
      >
        <p className="font-bold text-[12px] leading-none tracking-[0.16em] uppercase text-bg/70 truncate">
          {data.sessionName} · {shortDate(data.sessionDate)} · {rows.length} players
        </p>
        <h2 className="italic font-extrabold uppercase text-[40px] leading-[0.92]">
          Session
          <br />
          Results
        </h2>

        <div className="bc-slant [--slant:18px] bg-bg text-navy-deep flex items-stretch gap-2.5 pr-7 mt-1">
          <RankTab rank={1} className="[--slant:10px] text-[38px] pl-3 pr-5" />
          <div className="min-w-0 self-center py-2.5">
            <p className="italic font-extrabold uppercase text-[24px] leading-none truncate">
              {championNames}
            </p>
            <p className="font-bold uppercase tracking-[0.08em] text-[11px] leading-none text-navy-deep/70 mt-1.5">
              {record(lead)} · {Math.round(lead.form * 100)}% form
            </p>
          </div>
          <span className="ml-auto self-center italic font-extrabold text-[34px] leading-none tabular-nums">
            {lead.points}
          </span>
        </div>

        <ol className="flex flex-col gap-1.5">
          {following.map((row) => (
            <li
              key={row.playerId}
              className="bc-slant [--slant:12px] bg-navy-2 flex items-stretch gap-2.5 pr-6"
            >
              <RankTab
                rank={row.rank}
                neutral="bg-bg/15 text-bg"
                className="[--slant:6px] w-[34px] text-[18px] pr-1.5 py-1.5"
              />
              <span className="self-center italic font-bold uppercase text-[17px] leading-none truncate min-w-0">
                {row.name}
              </span>
              <span className="ml-auto self-center italic font-extrabold text-[18px] leading-none tabular-nums">
                {row.points}
              </span>
            </li>
          ))}
        </ol>

        {honors.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-1">
            {honors.map((honor) => (
              <li key={honor.kind}>
                <AwardChip honor={honor} showDetail={false} className="text-[11px]" />
              </li>
            ))}
          </ul>
        )}

        {/* The brand slot, kept for a club logo later. */}
        <p className="mt-auto text-right font-bold text-[10px] leading-none tracking-[0.26em] text-bg/60">
          TOP SEED
        </p>
      </div>
    </div>
  );
}
