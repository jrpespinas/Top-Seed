"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, Zap, Flame, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog } from "@/lib/match-log-store";
import { useSessionOptions, useSessionCheckIns } from "@/lib/session-store";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { ExportSheetModal } from "./ExportSheetModal";
import { RankTab, AwardChip, isPodium } from "./broadcast";
import { computeSessionRecap } from "@/lib/match-history";
import type { ShareSheetData } from "./ShareSheet";
import {
  computeLeaderboard,
  selectHonors,
  type LeaderboardRow,
  type LeaderboardSort,
  type MatchTypeFilter,
  type Honor,
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
 * Awards computed per session, shown as one row of coloured tags under the
 * podium. Three because there are five candidate awards, and two left the
 * deepest ones permanently unreachable.
 */
const HONOR_SLOTS = 3;

/**
 * Three, not two. A pair of wins happens constantly in a session of four-match
 * evenings — a chip on half the field says nothing about any of them. Three
 * consecutive wins is the point where a run is worth remarking on.
 */
const STREAK_CHIP_MINIMUM = 3;

/** Longest of the crown animations (the gold tab's flare); classes come off after. */
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
 * The podium, in the Broadcast style.
 *
 * The earlier version was a stepped three-card composition. On a wide screen
 * it left large empty areas above 2nd and 3rd and spread the award strip's
 * name and detail ~1,600px apart. The Broadcast layout stacks instead: one
 * full-width champion bar, the runners-up as a pair of bars beneath it, then
 * every award as a coloured tag. Nothing on the page is a void.
 *
 * Colour goes where people look for it: gold, silver and bronze rank tabs for
 * the top three, and one colour per award. That reverses an earlier rule that
 * podium frames must never use the metals, which existed only because skill
 * badges (also metals) sat inside the podium cards. The podium no longer shows
 * skill badges, so a gold tab can only mean 1st place here.
 */
function Apex({
  champions,
  runnersUp,
  honors,
  reveal,
  sort,
}: {
  champions: LeaderboardRow[];
  runnersUp: LeaderboardRow[];
  honors: Honor[];
  /** A new name is on top. See `useCrownReveal`. */
  reveal: boolean;
  sort: LeaderboardSort;
}) {
  const lead = champions[0];
  const names =
    champions.length <= 2
      ? champions.map((c) => c.name).join(" & ")
      : `${champions.length}-way tie`;

  return (
    <section className="px-4 sm:px-6 pt-4 pb-4 border-b border-border" aria-label="Session highlights">
      {/* Champion bar. `isolate overflow-hidden` keeps the crown wipe inside the
          bar's own slanted shape. */}
      <div className="relative isolate overflow-hidden bc-slant [--slant:24px] bg-primary text-bg">
        {reveal && (
          <span
            aria-hidden
            // Resting state is fully retreated, so an unplayed animation
            // leaves a finished bar rather than a blank one.
            style={{ clipPath: "inset(0 0 0 100%)" }}
            className="absolute inset-0 z-10 bg-primary-tint animate-crown-wipe motion-reduce:animate-none"
          />
        )}
        <div
          className={cn(
            "relative z-20 flex items-stretch gap-3 sm:gap-4 pr-9 sm:pr-11",
            reveal && "animate-crown-content motion-reduce:animate-none"
          )}
        >
          <RankTab
            rank={1}
            className={cn(
              "[--slant:12px] text-[40px] sm:text-[48px] pl-4 pr-6 sm:pl-5 sm:pr-7",
              reveal && "animate-tab-flare motion-reduce:animate-none"
            )}
          />
          <div className="min-w-0 py-3 sm:py-3.5 self-center">
            <h2 className="font-display italic font-extrabold uppercase leading-none text-[26px] sm:text-[34px] truncate">
              {names}
            </h2>
            <p className="font-display font-bold uppercase tracking-[0.06em] text-[13px] text-bg/75 mt-1.5">
              {record(lead)} · {Math.round(lead.form * 100)}% form
              {sort !== "points" && <> · Leading on {SORT_LABELS[sort]}</>}
            </p>
          </div>
          <div className="ml-auto self-center text-right leading-none flex-shrink-0">
            <span className="font-display italic font-extrabold text-[40px] sm:text-[48px] text-podium-gold tabular-nums">
              {lead.points}
            </span>
            <span className="block font-display font-bold text-[11px] tracking-[0.14em] text-bg/70 mt-0.5">
              PTS
            </span>
          </div>
        </div>
      </div>

      {runnersUp.length > 0 && (
        // `items-end` plus extra padding on 2nd keeps the podium step: second
        // stands a little taller than third.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 sm:items-end">
          {runnersUp.map((row) => (
            <RunnerBar key={row.playerId} row={row} reveal={reveal} />
          ))}
        </div>
      )}

      {/* Every award as one coloured tag naming its winner, including awards
          won by the podium. One row instead of tags on cards plus separate
          award cards, which is most of the space this layout saves. */}
      {honors.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-2.5" aria-label="Awards">
          {honors.map((honor) => (
            <li key={honor.kind}>
              <AwardChip honor={honor} className="text-[13px]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RunnerBar({ row, reveal }: { row: LeaderboardRow; reveal: boolean }) {
  const isSecond = row.rank === 2;
  return (
    <div
      className={cn(
        "bc-slant [--slant:16px] bg-primary-tint text-navy-deep flex items-stretch gap-3 pr-7",
        reveal && "animate-apex-rise motion-reduce:animate-none"
      )}
    >
      <RankTab rank={row.rank} className="[--slant:10px] text-[26px] pl-3 pr-5" />
      <div className={cn("min-w-0 self-center", isSecond ? "py-3" : "py-2")}>
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
  );
}

/** Numeral styling for ranks 4 and below. The top three show a metal rank tab. */
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
    return {
      champions: podium.filter((r) => r.rank === 1),
      runnersUp: podium.filter((r) => r.rank !== 1),
      honors: selectHonors(rankedRows, HONOR_SLOTS),
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

      {/* Content stops at 1,040px. Full-bleed, a wide screen put a player's
          points ~1,600px from their name, and the podium filled the extra
          width with empty space. */}
      <div className="w-full max-w-[1040px] mx-auto">
      {showApex && apex && (
        <Apex
          champions={apex.champions}
          runnersUp={apex.runnersUp}
          honors={apex.honors}
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
              <th className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2 w-[52px]">
                Rank
              </th>
              <th className="text-left text-xs font-medium text-muted px-3 py-2">Player</th>
              <th className="text-right text-xs font-medium text-muted px-3 py-2 w-[76px]">
                <abbr title="Wins–Draws–Losses" className="no-underline">
                  W–D–L
                </abbr>
              </th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2 w-[70px]">
                Matches
              </th>
              <th
                className="hidden sm:table-cell text-right text-xs font-medium text-muted px-3 py-2 w-[70px]"
                title="Win share with two pseudo-matches added — everyone starts the day 1–1, so an unproven record can't out-rank a real one"
              >
                Form
              </th>
              <th
                className="text-right text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2 w-[72px]"
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
                <td className="pl-4 sm:pl-6 pr-3 py-2">
                  {isPodium(row.rank) ? (
                    <RankTab rank={row.rank} className="[--slant:5px] w-7 h-5 pr-1 text-[15px]" />
                  ) : (
                    <span className={RANK_NUMERAL}>{row.rank}</span>
                  )}
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-ink truncate">{row.name}</span>
                    {/* The narrative the old eight columns had no room for.
                        Chips only appear when they're true, so a row without
                        them reads as ordinary rather than as missing data. */}
                    {row.currentStreak >= STREAK_CHIP_MINIMUM && (
                      <span
                        className="flex-shrink-0 bc-slant [--slant:4px] inline-flex items-center gap-0.5 font-display font-bold text-[12px] leading-none tabular-nums text-ink bg-award-fire pl-1 pr-2 py-0.5"
                        title={`On a ${row.currentStreak}-match winning streak`}
                      >
                        <Flame size={10} strokeWidth={2.5} aria-hidden />W{row.currentStreak}
                      </span>
                    )}
                    {row.bestUpset && (
                      <span
                        className="flex-shrink-0 bc-slant [--slant:4px] inline-flex items-center text-ink bg-award-giant pl-1 pr-2 py-0.5"
                        title={`Beat ${row.bestUpset.opponentNames.join(" & ")}, stronger opposition`}
                        aria-label="Beat stronger opposition"
                      >
                        <Zap size={10} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted whitespace-nowrap">{record(row)}</span>
                </td>
                <td className="hidden md:table-cell px-3 py-2 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">{row.matchesPlayed}</span>
                </td>
                <td className="hidden sm:table-cell px-3 py-2 text-right">
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {Math.round(row.form * 100)}%
                  </span>
                </td>
                <td className="pl-3 pr-4 sm:pr-6 py-2 text-right">
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
