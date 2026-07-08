"use client";

import { useState, useMemo } from "react";
import { Trophy, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog } from "@/lib/match-log-store";
import {
  computeLeaderboard,
  type LeaderboardSort,
  type MatchTypeFilter,
} from "@/lib/leaderboard";

const SORT_OPTIONS: { key: LeaderboardSort; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "winRate", label: "Win Rate" },
  { key: "matchesPlayed", label: "Matches Played" },
];

const MATCH_TYPE_OPTIONS: { key: MatchTypeFilter; label: string }[] = [
  { key: "SINGLES", label: "Singles" },
  { key: "DOUBLES", label: "Doubles" },
  { key: "ALL", label: "Combined" },
];

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
              "h-7 px-2.5 flex items-center rounded-md text-xs font-medium flex-shrink-0 whitespace-nowrap",
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

function rankClasses(rank: number): string {
  if (rank === 1) return "text-base font-bold text-primary tabular-nums";
  if (rank <= 3) return "text-sm font-semibold text-primary/80 tabular-nums";
  return "text-sm font-medium text-muted tabular-nums";
}

export function LeaderboardView() {
  const matches = useMatchLog();
  // Win Rate, not Wins, is the default sort — Wins is hidden below `lg:` (see
  // the table header below), so defaulting to it would make the visible order
  // look arbitrary against Win Rate, the one ranking number phones can see.
  const [sort, setSort] = useState<LeaderboardSort>("winRate");
  const [matchType, setMatchType] = useState<MatchTypeFilter>("ALL");
  const [search, setSearch] = useState("");

  const rankedRows = useMemo(
    () => computeLeaderboard(matches, { sort, matchType }),
    [matches, sort, matchType]
  );

  const rows = useMemo(() => {
    if (!search.trim()) return rankedRows;
    const q = search.trim().toLowerCase();
    return rankedRows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rankedRows, search]);

  const hasAnyCompletedMatches = useMemo(
    () => matches.some((m) => m.status === "COMPLETED"),
    [matches]
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header + filter bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] bg-bg">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 sm:px-6 h-14 border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Leaderboard</h1>
          <span className="font-mono text-xs text-muted tabular-nums">({rows.length})</span>
          <div className="relative ml-auto w-[160px] sm:w-[200px] flex-shrink-0">
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
              className="w-full bg-surface border border-border rounded-md pl-7 pr-7 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-8"
              aria-label="Find a player on the leaderboard"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus-visible:outline-none rounded"
                aria-label="Clear search"
              >
                <X size={12} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* Sort + filter row — merged into one row now that the date-range
            filter is gone (no real Session boundary exists to scope by yet;
            the whole match log already IS "this session" — see leaderboard.ts) */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

      {/* Table */}
      {rows.length > 0 ? (
        <table className="w-full border-collapse" role="grid" aria-label="Player rankings">
          {/* 105px = title bar (h-14, 56px) + the single sort/filter row (48px
              content + 1px border) — recalculate if the header stack above
              changes, matching PlayersView.tsx's identical convention. */}
          <thead className="sticky top-[105px] z-[var(--z-sticky)] bg-bg">
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted pl-4 sm:pl-6 pr-3 py-2.5 w-[52px]">
                Rank
              </th>
              <th className="text-left text-xs font-medium text-muted px-3 py-2.5">Player</th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[70px]">
                Matches
              </th>
              <th className="hidden lg:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[60px]">
                Wins
              </th>
              <th className="hidden lg:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[60px]">
                Draws
              </th>
              <th className="hidden lg:table-cell text-right text-xs font-medium text-muted px-3 py-2.5 w-[60px]">
                Losses
              </th>
              <th className="text-right text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 w-[80px]">
                Win Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              return (
                <tr
                  key={row.playerId}
                  className="border-b border-border/50 hover:bg-surface-elevated/40 transition-colors"
                >
                  <td className="pl-4 sm:pl-6 pr-3 py-3">
                    <span className={rankClasses(row.rank)} title={row.isTied ? "Tied on every ranking criterion" : undefined}>
                      {row.isTied ? `T-${row.rank}` : row.rank}
                    </span>
                  </td>
                  <td className="px-3 py-3 min-w-[140px]">
                    <span className="text-sm font-medium text-ink truncate">{row.name}</span>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-right">
                    <span className="font-mono text-sm tabular-nums text-muted">{row.matchesPlayed}</span>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 text-right">
                    <span className="font-mono text-sm tabular-nums text-muted">{row.wins}</span>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 text-right">
                    <span className="font-mono text-sm tabular-nums text-muted">{row.draws}</span>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 text-right">
                    <span className="font-mono text-sm tabular-nums text-muted">{row.losses}</span>
                  </td>
                  <td className="pl-3 pr-4 sm:pr-6 py-3 text-right">
                    <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                      {Math.round(row.winRate * 100)}%
                    </span>
                  </td>
                </tr>
              );
            })}
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
      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
        <Trophy size={20} strokeWidth={1.75} className="text-muted" aria-hidden />
      </div>
      <h2
        className="text-sm font-semibold text-ink mb-1"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        {searchExcludedEveryone
          ? "No players match your search"
          : hasAnyCompletedMatches
          ? "No matches of this type yet"
          : "No rankings yet"}
      </h2>
      {searchExcludedEveryone ? (
        <button
          onClick={onClearSearch}
          className="text-xs text-primary hover:text-primary-hover mt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
        >
          Clear search
        </button>
      ) : (
        <p className="text-xs text-muted">
          {hasAnyCompletedMatches
            ? "Try Singles, Doubles, or Combined"
            : "Rankings appear once matches are completed on the Dashboard"}
        </p>
      )}
    </div>
  );
}
