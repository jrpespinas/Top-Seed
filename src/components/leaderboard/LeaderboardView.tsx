"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, Zap, Flame, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog } from "@/lib/match-log-store";
import { useSessionOptions, useSessionCheckIns } from "@/lib/session-store";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { ExportSheetModal } from "./ExportSheetModal";
import { Medal, AwardStar, hasMedal } from "./medals";
import { computeSessionRecap } from "@/lib/match-history";
import type { ShareSheetData } from "./ShareSheet";
import {
  computeLeaderboard,
  selectHonors,
  championSummary,
  type LeaderboardRow,
  type LeaderboardSort,
  type MatchTypeFilter,
  type Honor,
  type HonorKind,
} from "@/lib/leaderboard";

const SORT_OPTIONS: { key: LeaderboardSort; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "form", label: "Form" },
  { key: "wins", label: "Wins" },
  { key: "matchesPlayed", label: "Matches Played" },
];

const MATCH_TYPE_OPTIONS: { key: MatchTypeFilter; label: string }[] = [
  { key: "SINGLES", label: "Singles" },
  { key: "DOUBLES", label: "Doubles" },
  { key: "ALL", label: "Combined" },
];

const SORT_LABELS: Record<LeaderboardSort, string> = {
  points: "Points",
  form: "Form",
  wins: "Wins",
  matchesPlayed: "Matches",
};

/**
 * Awards computed per session. Podium winners wear theirs as a tag on their own
 * card; only the rest become separate cards below, so this is a ceiling on
 * people recognised, not on cards rendered. Three because there are five
 * candidate awards — two left the deepest ones permanently unreachable.
 */
const HONOR_SLOTS = 3;

/**
 * Three, not two. A pair of wins happens constantly in a session of four-match
 * evenings — a chip on half the field says nothing about any of them. Three
 * consecutive wins is the point where a run is worth remarking on.
 */
const STREAK_CHIP_MINIMUM = 3;

/** Longest of the crown animations (the numeral flare); classes come off after. */
const CROWN_TOTAL_MS = 900;
const CROWN_STORAGE_PREFIX = "topseed:crowned:";

/**
 * True only when the top of the table has changed since this browser last
 * looked at this session.
 *
 * The animation is worth having *because* it is rare. An organiser opens the
 * leaderboard repeatedly across a night; a celebration that replays on every
 * mount stops reading as a celebration by the third viewing and becomes an
 * obstacle between them and the standings. Gating it on an actual change turns
 * the motion into information — "the lead changed" — which is the only kind of
 * motion the product register asks for.
 *
 * Read in an effect, never during render: touching localStorage while
 * rendering would desync the server and client markup. Wrapped because storage
 * throws outright in some privacy modes, where the correct fallback is a
 * leaderboard that simply doesn't animate.
 */
function useCrownReveal(sessionId: string | null, championKey: string | null): boolean {
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!sessionId || !championKey) return;
    const key = `${CROWN_STORAGE_PREFIX}${sessionId}`;
    let previous: string | null = null;
    try {
      previous = window.localStorage.getItem(key);
    } catch {
      return;
    }
    if (previous === championKey) return;
    try {
      window.localStorage.setItem(key, championKey);
    } catch {
      // Not fatal: the animation still plays, it just may play again later.
    }
    setReveal(true);
    const id = setTimeout(() => setReveal(false), CROWN_TOTAL_MS);
    return () => clearTimeout(id);
  }, [sessionId, championKey]);

  return reveal;
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={ariaLabel}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              "h-9 px-2.5 flex items-center rounded-md text-xs font-medium flex-shrink-0 whitespace-nowrap",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active
                ? "bg-surface-elevated text-primary border border-primary/40"
                : "text-muted hover:bg-surface-elevated hover:text-ink"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function record(row: LeaderboardRow): string {
  return `${row.wins}–${row.draws}–${row.losses}`;
}

/**
 * The apex.
 *
 * Three tiers of recognition in one composition, each a visibly different
 * object rather than the same card at three sizes: the champion on a filled
 * brand ground, runners-up outlined in the same blue, honors neutral and
 * quietest. Five people are named; the first one holds the centre.
 *
 * Ranks deliberately do NOT use gold / silver / bronze. That ladder is already
 * spoken for — `SkillBadge` runs Bronze → Platinum for Casual → Advanced, and
 * those badges sit inside these very slots. A gold rank-1 frame beside a gold
 * Intermediate badge would be one visual system saying two unrelated things.
 * Hierarchy runs on the brand blue, size, and position instead.
 */
function Apex({
  champions,
  runnersUp,
  honorByPlayer,
  standaloneHonors,
  championHoldsUpset,
  championHoldsStreak,
  reveal,
  sort,
}: {
  champions: LeaderboardRow[];
  runnersUp: LeaderboardRow[];
  honorByPlayer: Map<string, Honor>;
  standaloneHonors: Honor[];
  championHoldsUpset: boolean;
  championHoldsStreak: boolean;
  /** A new name is on top. See `useCrownReveal`. */
  reveal: boolean;
  sort: LeaderboardSort;
}) {
  const lead = champions[0];
  const championHonor = champions.length === 1 ? honorByPlayer.get(lead.playerId) ?? null : null;
  const summary =
    champions.length === 1
      ? championSummary(lead, {
          suppressUpset: championHoldsUpset,
          suppressStreak: championHoldsStreak,
        })
      : null;
  const names =
    champions.length <= 2
      ? champions.map((c) => c.name).join(" & ")
      : `${champions.length}-way tie`;

  return (
    <section
      className="px-4 sm:px-6 pt-5 pb-6 border-b border-border"
      aria-label="Session highlights"
    >
      <div className="grid grid-cols-2 gap-3 items-end md:grid-cols-[1fr_1.5fr_1fr]">
        {/* Champion — full width on mobile, centre column on desktop. */}
        <div
          className={cn(
            "col-span-2 md:col-span-1 md:order-2",
            // `isolate` so the sheet's stacking stays inside this card, and
            // `overflow-hidden` so the wipe is clipped to the rounded corners.
            "relative isolate overflow-hidden",
            "rounded-lg bg-primary text-bg px-5 py-5 sm:py-6 flex flex-col"
          )}
        >
          {reveal && (
            <span
              aria-hidden
              // Resting state is fully retreated, so an unplayed animation
              // leaves a finished blue card rather than a blank white one.
              style={{ clipPath: "inset(0 0 0 100%)" }}
              // Matches the runners-up ground, not plain white: the wipe's
              // premise is that the card starts as one of them and the brand
              // colour arrives. A white sheet would now start it as nothing.
              className="absolute inset-0 z-10 bg-primary-tint animate-crown-wipe motion-reduce:animate-none"
            />
          )}
          <div
            className={cn(
              "relative z-20 flex flex-col",
              reveal && "animate-crown-content motion-reduce:animate-none"
            )}
          >
            <div className="flex items-start gap-3">
              <Medal
                rank={1}
                className={cn(
                  "crown-medal inline-block text-4xl sm:text-5xl",
                  reveal && "animate-medal-flare motion-reduce:animate-none"
                )}
              />
              {champions.length === 1 && (
                <span className="ml-auto flex-shrink-0">
                  <SkillBadge level={lead.skillLevel} compact />
                </span>
              )}
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-balance break-words">
              {names}
            </h2>

            <p className="mt-1.5 font-mono text-sm tabular-nums text-bg/80">
              <span className="text-lg font-semibold text-bg">{lead.points}</span> pts
              <span className="text-bg/40"> · </span>
              {record(lead)}
              <span className="text-bg/40"> · </span>
              {Math.round(lead.form * 100)}% form
            </p>

            {summary && <p className="mt-2 text-sm text-bg/80 text-pretty">{summary}</p>}

            {championHonor && (
              <div className="mt-3 flex">
                <AwardTag honor={championHonor} onBrand />
              </div>
            )}

            {sort !== "points" && (
              <p className="mt-2 text-[11px] text-bg/60">Leading on {SORT_LABELS[sort]}</p>
            )}
          </div>
        </div>

        {runnersUp[0] && (
          <RunnerUp
            row={runnersUp[0]}
            honor={honorByPlayer.get(runnersUp[0].playerId) ?? null}
            reveal={reveal}
            className="md:order-1"
          />
        )}
        {runnersUp[1] && (
          <RunnerUp
            row={runnersUp[1]}
            honor={honorByPlayer.get(runnersUp[1].playerId) ?? null}
            reveal={reveal}
            className="md:order-3"
          />
        )}
      </div>

      {/* Only awards won from outside the top three. When the podium took them
          all, this renders nothing rather than an empty row. */}
      {standaloneHonors.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-3 grid-cols-1",
            standaloneHonors.length === 2 && "sm:grid-cols-2",
            standaloneHonors.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {standaloneHonors.map((honor) => (
            <HonorSlot key={honor.kind} honor={honor} />
          ))}
        </div>
      )}
    </section>
  );
}

function RunnerUp({
  row,
  honor,
  reveal,
  className,
}: {
  row: LeaderboardRow;
  honor: Honor | null;
  /** Rises only when the champion is being crowned — see `useCrownReveal`. */
  reveal: boolean;
  className?: string;
}) {
  // A real podium steps down: the champion towers, second stands above third.
  // Expressed as padding rather than a fixed height, so the extra room reads
  // as a roomier card rather than a card with a gap in it — and so a long name
  // wrapping to two lines still grows the box instead of overflowing it.
  const isSecond = row.rank === 2;
  return (
    <div
      className={cn(
        "rounded-lg bg-primary-tint border border-primary/20 flex flex-col",
        isSecond ? "px-4 py-5" : "px-3.5 py-3.5",
        reveal && "animate-apex-rise motion-reduce:animate-none",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {hasMedal(row.rank) ? (
          <Medal rank={row.rank} className={isSecond ? "text-[28px]" : "text-[22px]"} />
        ) : (
          <span className="font-mono font-bold leading-none text-primary/70 tabular-nums text-xl">
            {row.rank}
          </span>
        )}
        <span className="ml-auto flex-shrink-0">
          <SkillBadge level={row.skillLevel} compact dense />
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink truncate">{row.name}</p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">
        <span className="text-ink font-semibold">{row.points}</span> pts
        <span className="text-muted/50"> · </span>
        {record(row)}
      </p>
      {honor && (
        <div className="mt-2 flex">
          <AwardTag honor={honor} />
        </div>
      )}
    </div>
  );
}

/**
 * An award worn on a podium card, rather than given its own card below.
 *
 * Compact by necessity — it rides inside a card that already carries a rank,
 * a name, a points total and a record — so it shows the award's name and lets
 * the tooltip carry the detail. Standalone `HonorSlot` cards, which have the
 * room, print both.
 */
function AwardTag({ honor, onBrand = false }: { honor: Honor; onBrand?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold min-w-0",
        onBrand
          ? "bg-bg/15 text-bg"
          // Sits on the runners-up tint now, so a neutral chip would read as
          // a grey smudge on blue. White ground, brand text.
          : "bg-surface text-primary border border-primary/20"
      )}
      title={`${honor.label} — ${honor.detail}`}
    >
      <AwardStar className="text-[11px] flex-shrink-0" />
      <span className="truncate">{honor.label}</span>
      <span className="sr-only"> — {honor.detail}</span>
    </span>
  );
}

/**
 * Quietest of the three tiers on purpose. An honor recognises a moment, not a
 * placing — giving it podium weight would flatten the hierarchy the apex is
 * built to express.
 */
function HonorSlot({ honor }: { honor: Honor }) {
  return (
    <div className="rounded-lg bg-primary-tint-soft border border-primary/15 px-3.5 py-3 flex items-center gap-3">
      {/* White tile, not another tint: stacking two washes of the same hue
          muddies both. A cut-out reads as a chip and keeps the icon crisp. */}
      <span className="flex-shrink-0 w-8 h-8 rounded-md bg-surface flex items-center justify-center">
        <AwardStar className="text-base" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wide">{honor.label}</p>
        <p className="text-sm font-semibold text-ink truncate">{honor.name}</p>
      </div>
      <p
        className="text-xs text-muted text-right flex-shrink-0 max-w-[45%] truncate"
        title={honor.detail}
      >
        {honor.detail}
      </p>
    </div>
  );
}

/** Numeral styling for ranks 4 and below. The podium places show a medal instead. */
const RANK_NUMERAL = "text-sm font-medium text-muted tabular-nums";

export function LeaderboardView() {
  const matches = useMatchLog();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionOptions();
  const checkInByPlayer = useSessionCheckIns(selectedSessionId);
  // Points, not a rate, is the default. A rate makes a 2-match record look
  // like a 20-match one, and the previous default — a Wilson lower bound —
  // over-corrected for that at session sample sizes, rendering a 5-0 as 57%.
  // Points are additive, verifiable by the player who earned them, and the
  // one number that can't deflate on a perfect record. Form is the tiebreak
  // and stays available as its own sort for the rate view.
  const [sort, setSort] = useState<LeaderboardSort>("points");
  const [matchType, setMatchType] = useState<MatchTypeFilter>("ALL");
  const [search, setSearch] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);

  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === selectedSessionId),
    [matches, selectedSessionId]
  );

  const rankedRows = useMemo(
    () => computeLeaderboard(sessionMatches, { sort, matchType, checkInByPlayer }),
    [sessionMatches, sort, matchType, checkInByPlayer]
  );

  const rows = useMemo(() => {
    if (!search.trim()) return rankedRows;
    const q = search.trim().toLowerCase();
    return rankedRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rankedRows, search]);

  const apex = useMemo(() => {
    if (rankedRows.length === 0) return null;
    const podium = rankedRows.slice(0, 3);
    const champions = podium.filter((r) => r.rank === 1);
    const runnersUp = podium.filter((r) => r.rank !== 1);
    const honors = selectHonors(rankedRows, HONOR_SLOTS);

    // An award won by someone already on the podium belongs ON their card, not
    // repeated as a separate one below it — the podium card is where that
    // person is being recognised, and a second card carrying the same name
    // reads as a duplicate rather than a second honour. Only awards won from
    // outside the top three earn their own card, and when there are none the
    // strip is not rendered at all rather than left as an empty row.
    const podiumIds = new Set(podium.map((r) => r.playerId));
    const honorByPlayer = new Map(honors.map((h) => [h.playerId, h]));
    const standaloneHonors = honors.filter((h) => !podiumIds.has(h.playerId));

    // The champion's summary line must not narrate a fact their own award tag
    // is already showing a few pixels below it.
    const championHolds = (kind: HonorKind) =>
      champions.some((c) => honorByPlayer.get(c.playerId)?.kind === kind);

    return {
      champions,
      runnersUp,
      honorByPlayer,
      standaloneHonors,
      championHoldsUpset: championHolds("upset"),
      championHoldsStreak: championHolds("streak"),
    };
  }, [rankedRows]);

  // Search puts the reader in lookup mode, not recap mode — a podium above a
  // one-row result would be answering a question nobody asked.
  // Joined, so a shared first place counts as one champion: the lead has only
  // changed when the *set* of leaders changes.
  const championKey = useMemo(
    () => apex?.champions.map((c) => c.playerId).sort().join("+") ?? null,
    [apex]
  );
  const crownReveal = useCrownReveal(selectedSessionId, championKey);

  const showApex = apex !== null && !search.trim();

  /**
   * Built from the full session and the default ranking, never from whatever
   * is filtered or searched on screen. The sheet is the session's public
   * record — exporting "Doubles only, sorted by wins, filtered to Karl"
   * because that's what the page happened to be showing would produce a
   * standings sheet that quietly isn't the standings.
   */
  const sheetData = useMemo((): ShareSheetData | null => {
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return null;
    const rows = computeLeaderboard(sessionMatches, {
      matchType: "ALL",
      sort: "points",
      checkInByPlayer,
    });
    if (rows.length === 0) return null;
    const recap = computeSessionRecap(sessionMatches);
    return {
      sessionName: session.label,
      sessionDate: session.date,
      rows,
      honors: selectHonors(rows, HONOR_SLOTS),
      matchesPlayed: recap.matchesPlayed,
      totalCourtTimeMs: recap.totalCourtTimeMs,
    };
  }, [sessions, selectedSessionId, sessionMatches, checkInByPlayer]);

  const hasAnyCompletedMatches = useMemo(
    () => sessionMatches.some((m) => m.status === "COMPLETED"),
    [sessionMatches]
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center px-4 sm:px-6 min-h-[56px] pt-[env(safe-area-inset-top)] border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Leaderboard</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">No sessions yet</p>
          <p className="text-xs text-muted mt-1">Start your first session from the Dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header + filter bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] pt-[env(safe-area-inset-top)] bg-bg">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 sm:px-6 h-14 border-b border-border">
          <h1 className="text-lg font-semibold text-ink flex-shrink-0">Leaderboard</h1>
          <span className="font-mono text-xs text-muted tabular-nums hidden sm:inline">({rows.length})</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setIsExportOpen(true)}
              disabled={!sheetData}
              title={sheetData ? undefined : "No completed matches to export yet"}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2.5 py-1.5 rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent min-h-[36px]"
              aria-label="Export this session as a shareable sheet"
            >
              <Share2 size={13} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Export</span>
            </button>
            <SessionSelect sessions={sessions} value={selectedSessionId} onChange={setSelectedSessionId} />
          </div>
        </div>

        {/* Filter bar — search leads, then Sort/Match-type. Session scoping
            lives in the title bar above, not here: it changes which dataset
            is being ranked, not how the same dataset is displayed. Wraps on
            mobile (matching MatchesView's identical filter bar) now that it
            carries three control groups instead of two. */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative sm:w-[200px] flex-shrink-0">
            <Search
              size={13}
              strokeWidth={2}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Find a player…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border rounded-md pl-7 pr-8 py-1.5 text-base lg:text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-10"
              aria-label="Find a player on the leaderboard"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 flex items-center justify-center text-muted hover:text-ink transition-colors focus-visible:outline-none rounded"
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <span className="text-xs font-medium text-muted flex-shrink-0">Sort by</span>
            <PillGroup options={SORT_OPTIONS} value={sort} onChange={setSort} ariaLabel="Sort leaderboard by" />
            <div className="h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />
            <PillGroup
              options={MATCH_TYPE_OPTIONS}
              value={matchType}
              onChange={setMatchType}
              ariaLabel="Filter by match type"
            />
          </div>
        </div>
      </div>

      {showApex && apex && (
        <Apex
          champions={apex.champions}
          runnersUp={apex.runnersUp}
          honorByPlayer={apex.honorByPlayer}
          standaloneHonors={apex.standaloneHonors}
          championHoldsUpset={apex.championHoldsUpset}
          championHoldsStreak={apex.championHoldsStreak}
          reveal={crownReveal}
          sort={sort}
        />
      )}

      {/* Table */}
      {rows.length > 0 ? (
        <table className="w-full border-collapse" role="grid" aria-label="Player rankings">
          {/* Offsets track the sticky header stack above, which changes height
              at sm: (search stacks above the pills on mobile, sits beside them
              from sm:). The apex is NOT part of this maths — it scrolls away
              above and the header sticks at the same place either way.
              Mobile:  title (h-14, 56px) + filter bar (py-2.5=20 + search
                       row 40 + gap-2=8 + pills row 36 + border 1) = 56+105=161
              sm+:     title (56) + filter bar (py-2.5=20 + max(40,36)=40
                       + border 1) = 56+61=117
              Recalculate both if that stack changes. Each also adds
              env(safe-area-inset-top) — 0 on non-notched devices, the actual
              notch height on ones that have it — matching the wrapper above. */}
          <thead className="sticky top-[calc(161px+env(safe-area-inset-top))] sm:top-[calc(117px+env(safe-area-inset-top))] z-[var(--z-sticky)] bg-bg">
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2.5 w-[52px]">
                Rank
              </th>
              <th className="text-left text-xs font-medium text-muted px-3 py-2.5">Player</th>
              <th className="text-right text-xs font-medium text-muted px-3 py-2.5 w-[76px]">
                <abbr title="Wins–Draws–Losses" className="no-underline">
                  W–D–L
                </abbr>
              </th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[70px]">
                Matches
              </th>
              <th
                className="hidden sm:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[70px]"
                title="Win share with two pseudo-matches added — everyone starts the day 1–1, so an unproven record can't out-rank a real one"
              >
                Form
              </th>
              <th
                className="text-right text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 w-[72px]"
                title="3 points a win, 1 a draw, plus a bonus for beating stronger opposition"
              >
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.playerId}
                className="border-b border-border/50 hover:bg-surface-elevated/40 transition-colors"
              >
                <td className="pl-4 sm:pl-6 pr-3 py-3">
                  {hasMedal(row.rank) ? (
                    <Medal rank={row.rank} className="text-lg" />
                  ) : (
                    <span className={RANK_NUMERAL}>{row.rank}</span>
                  )}
                </td>
                <td className="px-3 py-3 min-w-[140px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-ink truncate">{row.name}</span>
                    {/* The narrative the old eight columns had no room for.
                        Chips only appear when they're true, so a row without
                        them reads as ordinary rather than as missing data. */}
                    {row.currentStreak >= STREAK_CHIP_MINIMUM && (
                      <span
                        className="flex-shrink-0 inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary bg-primary/[0.08] border border-primary/20 rounded-sm px-1 py-0.5"
                        title={`On a ${row.currentStreak}-match winning streak`}
                      >
                        <Flame size={9} strokeWidth={2.5} aria-hidden />W{row.currentStreak}
                      </span>
                    )}
                    {row.bestUpset && (
                      <span
                        className="flex-shrink-0 inline-flex items-center text-muted"
                        title={`Beat ${row.bestUpset.opponentNames.join(" & ")} — stronger opposition`}
                        aria-label="Beat stronger opposition"
                      >
                        <Zap size={11} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{record(row)}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{row.matchesPlayed}</span>
                </td>
                <td className="hidden sm:table-cell px-3 py-3 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {Math.round(row.form * 100)}%
                  </span>
                </td>
                <td className="pl-3 pr-4 sm:pr-6 py-3 text-right">
                  <span
                    className="font-mono text-sm font-semibold tabular-nums text-ink"
                    title={
                      row.bonusPoints > 0
                        ? `${row.points} = ${row.resultPoints} from results + ${row.bonusPoints} bonus`
                        : `${row.resultPoints} from ${row.wins} wins and ${row.draws} draws`
                    }
                  >
                    {row.points}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState
          hasAnyCompletedMatches={hasAnyCompletedMatches}
          searchExcludedEveryone={rankedRows.length > 0 && search.trim().length > 0}
          onClearSearch={() => setSearch("")}
        />
      )}

      <ExportSheetModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        data={sheetData}
      />
    </div>
  );
}

function EmptyState({
  hasAnyCompletedMatches,
  searchExcludedEveryone,
  onClearSearch,
}: {
  hasAnyCompletedMatches: boolean;
  searchExcludedEveryone: boolean;
  onClearSearch: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <p className="text-sm text-muted">
        {searchExcludedEveryone
          ? "No players match your search"
          : hasAnyCompletedMatches
          ? "No matches of this type yet"
          : "No rankings yet"}
      </p>
      {searchExcludedEveryone ? (
        <button
          onClick={onClearSearch}
          className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
        >
          Clear search
        </button>
      ) : (
        <p className="text-xs text-muted mt-1">
          {hasAnyCompletedMatches
            ? "Try Singles, Doubles, or Combined"
            : "Rankings appear once matches are completed on the Dashboard"}
        </p>
      )}
    </div>
  );
}
