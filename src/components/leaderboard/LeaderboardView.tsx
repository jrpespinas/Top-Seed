"use client";

import { useState, useMemo } from "react";
import { Search, X, Zap, Flame, Timer, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog } from "@/lib/match-log-store";
import { useSessionOptions } from "@/lib/session-store";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { SkillBadge } from "@/components/ui/SkillBadge";
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

const HONOR_ICONS: Record<HonorKind, typeof Zap> = {
  upset: Zap,
  streak: Flame,
  onCourt: Timer,
  pair: Users,
};

/** Slots flanking the podium. Two keeps the apex to five recognised players. */
const HONOR_SLOTS = 2;

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
  honors,
  sort,
}: {
  champions: LeaderboardRow[];
  runnersUp: LeaderboardRow[];
  honors: Honor[];
  sort: LeaderboardSort;
}) {
  const lead = champions[0];
  const summary = champions.length === 1 ? championSummary(lead) : null;
  const names =
    champions.length <= 2
      ? champions.map((c) => c.name).join(" & ")
      : `${champions.length}-way tie`;

  return (
    <section
      className="px-4 sm:px-6 pt-5 pb-6 border-b border-border"
      aria-label="Session highlights"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1.5fr_1fr] md:items-end">
        {/* Champion — full width on mobile, centre column on desktop. */}
        <div
          className={cn(
            "col-span-2 md:col-span-1 md:order-2 animate-apex-rise motion-reduce:animate-none",
            "rounded-lg bg-primary text-bg px-5 py-5 sm:py-6 flex flex-col"
          )}
        >
          <div className="flex items-start gap-3">
            <span className="font-mono text-3xl sm:text-4xl font-bold leading-none text-bg/55 tabular-nums">
              1
            </span>
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

          {sort !== "points" && (
            <p className="mt-2 text-[11px] text-bg/60">Leading on {SORT_LABELS[sort]}</p>
          )}
        </div>

        {runnersUp[0] && <RunnerUp row={runnersUp[0]} className="md:order-1" />}
        {runnersUp[1] && <RunnerUp row={runnersUp[1]} className="md:order-3" />}
      </div>

      {honors.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {honors.map((honor) => (
            <HonorSlot key={honor.kind} honor={honor} />
          ))}
        </div>
      )}
    </section>
  );
}

function RunnerUp({ row, className }: { row: LeaderboardRow; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface border border-primary/25 px-3.5 py-3.5 flex flex-col",
        "animate-apex-rise motion-reduce:animate-none",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <span className="font-mono text-xl font-bold leading-none text-primary/70 tabular-nums">
          {row.rank}
        </span>
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
    </div>
  );
}

/**
 * Quietest of the three tiers on purpose. An honor recognises a moment, not a
 * placing — giving it podium weight would flatten the hierarchy the apex is
 * built to express.
 */
function HonorSlot({ honor }: { honor: Honor }) {
  const Icon = HONOR_ICONS[honor.kind];
  return (
    <div className="rounded-lg bg-surface border border-border px-3.5 py-3 flex items-center gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-md bg-surface-elevated flex items-center justify-center text-muted">
        <Icon size={15} strokeWidth={2} aria-hidden />
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

function rankClasses(rank: number): string {
  if (rank === 1) return "text-base font-bold text-primary tabular-nums";
  if (rank <= 3) return "text-sm font-semibold text-primary/80 tabular-nums";
  return "text-sm font-medium text-muted tabular-nums";
}

export function LeaderboardView() {
  const matches = useMatchLog();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionOptions();
  // Points, not a rate, is the default. A rate makes a 2-match record look
  // like a 20-match one, and the previous default — a Wilson lower bound —
  // over-corrected for that at session sample sizes, rendering a 5-0 as 57%.
  // Points are additive, verifiable by the player who earned them, and the
  // one number that can't deflate on a perfect record. Form is the tiebreak
  // and stays available as its own sort for the rate view.
  const [sort, setSort] = useState<LeaderboardSort>("points");
  const [matchType, setMatchType] = useState<MatchTypeFilter>("ALL");
  const [search, setSearch] = useState("");

  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === selectedSessionId),
    [matches, selectedSessionId]
  );

  const rankedRows = useMemo(
    () => computeLeaderboard(sessionMatches, { sort, matchType }),
    [sessionMatches, sort, matchType]
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
    const honors = selectHonors(
      rankedRows,
      HONOR_SLOTS,
      new Set(podium.map((r) => r.playerId))
    );
    return { champions, runnersUp, honors };
  }, [rankedRows]);

  // Search puts the reader in lookup mode, not recap mode — a podium above a
  // one-row result would be answering a question nobody asked.
  const showApex = apex !== null && !search.trim();

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
          <div className="ml-auto">
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
          honors={apex.honors}
          sort={sort}
        />
      )}

      {/* "T-" legend — the row-level title tooltip is mouse-only and never
          fires on touch, the primary input here. Fires far less often since
          points replaced a percentage: identical rates were common, identical
          point totals with identical form much less so. */}
      {rows.some((r) => r.isTied) && (
        <p className="px-4 sm:px-6 py-1.5 text-[10px] text-muted bg-surface-elevated/40 border-b border-border/60">
          T- = tied with another player on every ranking criterion
        </p>
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
                  <span
                    className={rankClasses(row.rank)}
                    title={row.isTied ? "Tied on every ranking criterion" : undefined}
                  >
                    {row.isTied ? `T-${row.rank}` : row.rank}
                  </span>
                </td>
                <td className="px-3 py-3 min-w-[140px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-ink truncate">{row.name}</span>
                    {/* The narrative the old eight columns had no room for.
                        Chips only appear when they're true, so a row without
                        them reads as ordinary rather than as missing data. */}
                    {row.currentStreak >= 2 && (
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
