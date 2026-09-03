"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, ListChecks, Zap, Timer, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog, updateMatchRecord } from "@/lib/match-log-store";
import { useSessionOptions } from "@/lib/session-store";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { useToast, ToastViewport } from "@/components/ui/Toast";
import { computeLeaderboard, matchUpset } from "@/lib/leaderboard";
import {
  computeSessionRecap,
  matchDurationMs,
  formatDurationMs,
  outcomeForPlayer,
  findSearchedPlayer,
  playerSide,
  type PlayerOutcome,
} from "@/lib/match-history";
import type { MatchRecord, Player } from "@/types";

type ResultFilter = "all" | "wins" | "losses" | "draws" | "voided";
type MatchListItem =
  | { type: "match"; data: MatchRecord }
  | { type: "group-header"; label: string };

const RESULT_FILTERS: { key: ResultFilter; label: string; needsPlayer?: boolean }[] = [
  { key: "all", label: "All" },
  { key: "wins", label: "Wins", needsPlayer: true },
  { key: "losses", label: "Losses", needsPlayer: true },
  { key: "draws", label: "Draws" },
  { key: "voided", label: "Voided" },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatHourGroup(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
}

/** Plain-text join for aria-labels and tooltips, where "&" has no visual work to do. */
function formatSideText(players: Player[]): string {
  return players.map((p) => p.name).join(" & ");
}

function getWinningSide(match: MatchRecord): "A" | "B" | null {
  if (match.status === "VOIDED" || !match.result || match.result === "DRAW") return null;
  return match.result === "SIDE_A" ? "A" : "B";
}

export function MatchesView() {
  const matches = useMatchLog();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionOptions();
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [onlyUpsets, setOnlyUpsets] = useState(false);
  const [onlyLong, setOnlyLong] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { toast, showToast, dismissAndUndo } = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);

  // Voiding is a real soft-delete, not toast-window-only: a voided row keeps a
  // persistent "Restore" action indefinitely, not just during the undo toast.
  // previousResult preserves the original result so Restore brings back the
  // real outcome instead of leaving it permanently blank.
  const handleRestore = useCallback(
    (id: string) => {
      const match = matches.find((m) => m.id === id);
      updateMatchRecord(id, {
        status: "COMPLETED",
        result: match?.previousResult ?? null,
        previousResult: undefined,
      });
    },
    [matches]
  );

  const handleVoid = useCallback(
    (id: string) => {
      const match = matches.find((m) => m.id === id);
      updateMatchRecord(id, {
        status: "VOIDED",
        result: null,
        previousResult: match?.result ?? null,
      });
      setConfirmingId(null);
      showToast("Match voided", () => handleRestore(id), "Undo void");
    },
    [matches, showToast, handleRestore]
  );

  // A match can only be selected while it's COMPLETED. Prune stale ids if a
  // selected match is restored, voided elsewhere, or removed by a cross-tab
  // sync while mid-review.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => matches.some((m) => m.id === id && m.status === "COMPLETED"))
      );
      return next.size === prev.size ? prev : next;
    });
  }, [matches]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchConfirming(false);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBatchVoidConfirm = useCallback(() => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const match = matches.find((m) => m.id === id);
      if (!match) continue;
      updateMatchRecord(id, { status: "VOIDED", result: null, previousResult: match.result });
    }
    exitSelectMode();
    showToast(
      `Voided ${ids.length} match${ids.length !== 1 ? "es" : ""}`,
      () => {
        for (const id of ids) handleRestore(id);
      },
      "Undo batch void"
    );
  }, [selectedIds, matches, exitSelectMode, showToast, handleRestore]);

  // Escape steps back one level: confirm → selecting → default, matching the
  // per-row void confirm's own Escape behavior elsewhere in this app.
  useEffect(() => {
    if (!selectMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (batchConfirming) setBatchConfirming(false);
      else exitSelectMode();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectMode, batchConfirming, exitSelectMode]);

  const sessionMatches = useMemo(
    () => matches.filter((m) => m.sessionId === selectedSessionId),
    [matches, selectedSessionId]
  );

  /**
   * Search resolves to a *person*, not a substring, and every framed result on
   * the page hangs off this one identity. Rows then filter to that player's
   * matches rather than to any row containing a name that happens to match —
   * so searching "kar" shows Karl's night, not a mixture of Karl's and
   * Karina's with win/loss badges computed against whichever of them the row
   * happened to contain.
   */
  const searchedPlayer = useMemo(
    () => findSearchedPlayer(sessionMatches, search),
    [sessionMatches, search]
  );

  /**
   * The long-match threshold comes from the WHOLE session, never the filtered
   * set. Derive it from the filtered set and activating "Long" would recompute
   * the median from long matches only, then immediately exclude the shorter
   * half of them — a filter that changes its own definition as you apply it.
   */
  const longThresholdMs = useMemo(
    () => computeSessionRecap(sessionMatches).longMatchThresholdMs,
    [sessionMatches]
  );

  const isLongMatch = useCallback(
    (match: MatchRecord) => {
      if (longThresholdMs === null) return false;
      const duration = matchDurationMs(match);
      return duration !== null && duration >= longThresholdMs;
    },
    [longThresholdMs]
  );

  const filteredMatches = useMemo(() => {
    return sessionMatches.filter((match) => {
      if (search.trim()) {
        if (!searchedPlayer || !playerSide(match, searchedPlayer.id)) return false;
      }
      if (onlyUpsets && !matchUpset(match)) return false;
      if (onlyLong && !isLongMatch(match)) return false;

      switch (resultFilter) {
        case "all":
          return true;
        case "voided":
          return match.status === "VOIDED";
        case "draws":
          return match.result === "DRAW" && match.status !== "VOIDED";
        case "wins":
        case "losses": {
          // Gated in the UI, but a stale filter can outlive its search for one
          // render; framing against nobody is what made these meaningless before.
          if (!searchedPlayer) return false;
          const outcome = outcomeForPlayer(match, searchedPlayer.id);
          return outcome === (resultFilter === "wins" ? "win" : "loss");
        }
      }
    });
  }, [sessionMatches, search, searchedPlayer, resultFilter, onlyUpsets, onlyLong, isLongMatch]);

  // Wins and Losses only mean something relative to a player. Clearing the
  // search leaves them framed against nobody, which is exactly the state that
  // used to silently fall through to "Side A won".
  useEffect(() => {
    if (!searchedPlayer && (resultFilter === "wins" || resultFilter === "losses")) {
      setResultFilter("all");
    }
  }, [searchedPlayer, resultFilter]);

  /** Always describes what's on screen — a header summarising the whole
   *  session while the list shows a filtered subset would be quietly lying. */
  const recap = useMemo(() => computeSessionRecap(filteredMatches), [filteredMatches]);

  const playerRow = useMemo(() => {
    if (!searchedPlayer) return null;
    return (
      computeLeaderboard(filteredMatches, { matchType: "ALL", sort: "points" }).find(
        (r) => r.playerId === searchedPlayer.id
      ) ?? null
    );
  }, [filteredMatches, searchedPlayer]);

  const visibleSelectableCount = useMemo(
    () => filteredMatches.filter((m) => m.status === "COMPLETED").length,
    [filteredMatches]
  );

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of filteredMatches) if (m.status === "COMPLETED") next.add(m.id);
      return next;
    });
  }, [filteredMatches]);

  const groupedItems = useMemo((): MatchListItem[] => {
    if (filteredMatches.length === 0) return [];
    const items: MatchListItem[] = [];
    let lastHourKey = "";
    for (const match of filteredMatches) {
      const hourKey = formatHourGroup(match.startedAt);
      if (hourKey !== lastHourKey) {
        items.push({ type: "group-header", label: hourKey });
        lastHourKey = hourKey;
      }
      items.push({ type: "match", data: match });
    }
    return items;
  }, [filteredMatches]);

  const hasFilters = !!search.trim() || resultFilter !== "all" || onlyUpsets || onlyLong;

  const clearFilters = () => {
    setSearch("");
    setResultFilter("all");
    setOnlyUpsets(false);
    setOnlyLong(false);
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="flex items-center px-4 sm:px-6 min-h-[56px] pt-[env(safe-area-inset-top)] border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Matches</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-sm text-muted">No sessions yet</p>
          <p className="text-xs text-muted mt-1">Start your first session from the Dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col min-h-full", selectMode && "pb-20")}>
      {/* Sticky header + filter bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] pt-[env(safe-area-inset-top)] bg-bg">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 sm:px-6 h-14 border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Matches</h1>
          <span className="hidden sm:inline font-mono text-xs text-muted tabular-nums">
            (
            {filteredMatches.length !== sessionMatches.length
              ? `${filteredMatches.length} of ${sessionMatches.length}`
              : sessionMatches.length}
            )
          </span>
          <span className="hidden lg:inline text-xs text-muted">
            · {matches.length} recorded locally
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!selectMode && (
              <button
                onClick={() => setSelectMode(true)}
                disabled={sessionMatches.length === 0}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2.5 py-1.5 rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent min-h-[36px]"
                aria-label="Select multiple matches to void at once"
              >
                <ListChecks size={13} strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">Select</span>
              </button>
            )}
            <SessionSelect
              sessions={sessions}
              value={selectedSessionId}
              onChange={setSelectedSessionId}
            />
          </div>
        </div>

        {/* Mobile-only local-storage transparency line — shown inline in the
            title bar at lg+, but that's hidden on phones, which is exactly the
            device class this app targets first courtside. Deliberately the
            global total, not session-scoped. */}
        <p className="lg:hidden px-4 sm:px-6 pt-2 pb-1.5 text-xs text-muted border-b border-border">
          {matches.length} match{matches.length !== 1 ? "es" : ""} recorded locally
        </p>

        {/* Filter bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative sm:w-[220px] flex-shrink-0">
            <Search
              size={13}
              strokeWidth={2}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search by player…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border rounded-md pl-7 pr-8 py-1.5 text-base lg:text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-10"
              aria-label="Search by player name"
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

          {/* Two groups split by a divider, matching the Leaderboard's
              Sort | Type bar: the left group picks one result, the right
              toggles highlights that stack on top of it. */}
          <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-1" role="group" aria-label="Filter by result">
              {RESULT_FILTERS.map(({ key, label, needsPlayer }) => {
                const gated = !!needsPlayer && !searchedPlayer;
                const active = resultFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setResultFilter(key)}
                    disabled={gated}
                    aria-pressed={active}
                    // A win only exists relative to someone. These used to fall
                    // through to `result === "SIDE_A"` — an arbitrary split of
                    // the same matches. Disabled with a reason beats wrong.
                    title={gated ? "Search a player to filter their wins and losses" : undefined}
                    className={cn(
                      "h-9 px-2.5 flex items-center rounded-md text-xs font-medium flex-shrink-0 whitespace-nowrap",
                      "transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      gated
                        ? "text-muted/40 cursor-not-allowed"
                        : active
                        ? "bg-surface-elevated text-primary border border-primary/40"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />

            <div className="flex items-center gap-1" role="group" aria-label="Highlights">
              <HighlightToggle
                label="Upsets"
                icon={Zap}
                active={onlyUpsets}
                onToggle={() => setOnlyUpsets((v) => !v)}
                title="Matches won by the weaker side"
              />
              <HighlightToggle
                label="Long"
                icon={Timer}
                active={onlyLong}
                onToggle={() => setOnlyLong((v) => !v)}
                disabled={longThresholdMs === null}
                title={
                  longThresholdMs === null
                    ? "Needs at least three timed matches to know what long means here"
                    : `Matches running past ${formatDurationMs(longThresholdMs)}`
                }
              />
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:text-primary-hover transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 sm:ml-auto"
            >
              Clear
            </button>
          )}
        </div>

        {selectMode && (
          <div className="px-4 sm:px-6 py-2 border-b border-border flex items-center gap-3">
            <button
              onClick={selectAllVisible}
              disabled={visibleSelectableCount === 0}
              className="text-xs text-primary hover:text-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-primary"
            >
              Select all visible ({visibleSelectableCount})
            </button>
            <span className="text-xs text-muted">{selectedIds.size} selected</span>
          </div>
        )}
      </div>

      {/* Recap — hidden in select mode, where you're editing rather than reading. */}
      {!selectMode && filteredMatches.length > 0 && (
        <Recap recap={recap} player={searchedPlayer} playerRow={playerRow} />
      )}

      {/* Match list */}
      <div>
        {groupedItems.length > 0 ? (
          <div role="list" aria-label="Match history">
            {groupedItems.map((item, i) => {
              if (item.type === "group-header") {
                return (
                  <div
                    key={`hdr-${item.label}-${i}`}
                    className="px-4 sm:px-6 py-1.5 bg-surface-elevated/30 border-b border-border/60"
                    aria-hidden
                  >
                    <span className="text-[11px] font-mono font-medium text-muted tabular-nums">
                      {item.label}
                    </span>
                  </div>
                );
              }

              const match = item.data;
              return (
                <MatchRow
                  key={match.id}
                  match={match}
                  outcome={searchedPlayer ? outcomeForPlayer(match, searchedPlayer.id) : null}
                  isLong={isLongMatch(match)}
                  isConfirming={confirmingId === match.id}
                  onVoidStart={() => setConfirmingId(match.id)}
                  onVoidCancel={() => setConfirmingId(null)}
                  onVoidConfirm={() => handleVoid(match.id)}
                  onRestore={() => handleRestore(match.id)}
                  selectMode={selectMode}
                  isSelected={selectedIds.has(match.id)}
                  onToggleSelect={() => toggleSelected(match.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
        )}
      </div>

      {/* Batch action bar — present for the full duration of select mode, so
          there's always an obvious way out, not just once something's checked. */}
      {selectMode && (
        <div
          role="region"
          aria-label="Batch void selected matches"
          className={cn(
            // Below md: stacks above BottomBar, whose own height already grew
            // by the same inset. At md+: BottomBar doesn't exist, so this bar
            // sits flush at the true bottom edge and needs its own inset.
            "fixed bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-[var(--z-toast)]",
            "bg-surface border-t border-border px-4 sm:px-6 pt-3 pb-3 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg"
          )}
        >
          {!batchConfirming ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink flex-1">{selectedIds.size} selected</span>
              <button
                onClick={exitSelectMode}
                className="text-sm text-muted hover:text-ink transition-colors px-3 py-2 rounded-md min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
              >
                Cancel
              </button>
              <button
                onClick={() => setBatchConfirming(true)}
                disabled={selectedIds.size === 0}
                className="text-sm font-semibold text-error bg-error/15 hover:bg-error/25 transition-colors px-4 py-2 rounded-md min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-error/15"
              >
                Void {selectedIds.size} match{selectedIds.size !== 1 ? "es" : ""}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink flex-1">
                Void {selectedIds.size} match{selectedIds.size !== 1 ? "es" : ""}? This can be
                restored per-match afterward.
              </span>
              <button
                onClick={() => setBatchConfirming(false)}
                className="text-sm text-muted hover:text-ink transition-colors px-3 py-2 rounded-md min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchVoidConfirm}
                className="text-sm font-semibold text-error bg-error/15 hover:bg-error/25 transition-colors px-4 py-2 rounded-md min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                Confirm Void
              </button>
            </div>
          )}
        </div>
      )}

      <ToastViewport toast={toast} onDismissAndUndo={dismissAndUndo} />
    </div>
  );
}

function HighlightToggle({
  label,
  icon: Icon,
  active,
  onToggle,
  disabled,
  title,
}: {
  label: string;
  icon: typeof Zap;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cn(
        "h-9 px-2.5 flex items-center gap-1 rounded-md text-xs font-medium flex-shrink-0 whitespace-nowrap",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        disabled
          ? "text-muted/40 cursor-not-allowed"
          : active
          ? "bg-surface-elevated text-primary border border-primary/40"
          : "text-muted hover:bg-surface-elevated hover:text-ink"
      )}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {label}
    </button>
  );
}

/**
 * The header always describes exactly what's on screen.
 *
 * Two modes in one slot rather than two components: with no player searched it
 * answers "what happened", and once search resolves to a person it answers
 * "how did their night go" — same shape, same position, numbers rescoped. That
 * second mode is doing double duty, because there is no `/players/[id]` route
 * anywhere in this app; this is the only place a player's session is narrated.
 *
 * Deliberately carries no points or ranking. Those belong to the Leaderboard,
 * and two surfaces computing a standing is two surfaces that can disagree.
 */
function Recap({
  recap,
  player,
  playerRow,
}: {
  recap: ReturnType<typeof computeSessionRecap>;
  player: Player | null;
  playerRow: ReturnType<typeof computeLeaderboard>[number] | null;
}) {
  const cells: { value: string; label: string; strong?: boolean }[] = [];

  if (player && playerRow) {
    cells.push({
      value: `${playerRow.wins}–${playerRow.draws}–${playerRow.losses}`,
      label: "record",
      strong: true,
    });
    if (playerRow.timeOnCourtMs > 0) {
      cells.push({ value: formatDurationMs(playerRow.timeOnCourtMs), label: "on court" });
    }
    if (playerRow.currentStreak >= 2) {
      cells.push({ value: `W${playerRow.currentStreak}`, label: "on the trot" });
    }
    if (playerRow.bestUpset) {
      cells.push({
        value: `beat ${playerRow.bestUpset.opponentNames.join(" & ")}`,
        label: "best win",
      });
    }
  } else {
    cells.push({
      value: String(recap.matchesPlayed),
      label: `match${recap.matchesPlayed === 1 ? "" : "es"}`,
      strong: true,
    });
    if (recap.totalCourtTimeMs > 0) {
      cells.push({ value: formatDurationMs(recap.totalCourtTimeMs), label: "court time" });
    }
    if (recap.longest) {
      // Naming one side without saying which would read as "these two played
      // the longest match" when they were only half of it.
      const winner = getWinningSide(recap.longest.match);
      const longestLabel = winner
        ? `longest · won by ${formatSideText(
            winner === "A" ? recap.longest.match.sideA : recap.longest.match.sideB
          )}`
        : "longest · drawn";
      cells.push({ value: formatDurationMs(recap.longest.durationMs), label: longestLabel });
    }
    if (recap.upsetCount > 0) {
      cells.push({
        value: String(recap.upsetCount),
        label: `upset${recap.upsetCount === 1 ? "" : "s"}`,
      });
    }
  }

  if (cells.length === 0) return null;

  return (
    <section
      className="px-4 sm:px-6 py-3.5 bg-surface border-b border-border animate-apex-rise motion-reduce:animate-none"
      aria-label={player ? `${player.name} this session` : "Session summary"}
    >
      {player && (
        <div className="flex items-center gap-2 mb-2.5 min-w-0">
          <h2 className="text-sm font-semibold text-ink truncate">{player.name}</h2>
          <SkillBadge level={player.skillLevel} compact dense />
        </div>
      )}
      <dl className="flex flex-wrap items-baseline gap-x-7 gap-y-2.5">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dd
              className={cn(
                "font-mono tabular-nums text-ink truncate",
                cell.strong ? "text-lg font-semibold" : "text-sm font-medium"
              )}
            >
              {cell.value}
            </dd>
            <dt className="text-[11px] text-muted truncate">{cell.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * One side of the matchup.
 *
 * The result is marked HERE, on the winning side, rather than spelled out in
 * the connector between the two. A verb ("beat") was tried and reverted: a
 * session is mostly decisive matches, so the word was identical on every row —
 * constant text in the most central slot of the layout, carrying no
 * information while costing the fixture-list reading everyone already knows.
 * A mark on the winner varies by *position* instead, left or right, which is
 * what makes it scannable down a long log.
 *
 * The winner is still not filled with brand blue — forty filled chips would be
 * a wall of colour that stops meaning anything. The losing side recedes
 * instead: the same asymmetry at a fraction of the ink.
 */
function TeamChip({ players, tone }: { players: Player[]; tone: "winner" | "loser" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 min-w-0 flex-shrink px-2 py-1 rounded-md border transition-colors",
        tone === "winner" && "bg-primary/[0.07] border-primary/35 text-ink font-medium",
        tone === "loser" && "bg-transparent border-border/50 text-muted",
        tone === "neutral" && "bg-surface-elevated/70 border-transparent text-ink"
      )}
    >
      {tone === "winner" && (
        <Check size={13} strokeWidth={3} className="text-primary flex-shrink-0" aria-hidden />
      )}
      {players.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1.5 min-w-0">
          {/* A middot reads clearly as "separate player" next to a two-word
              name like "Aims Guinto", where a 1px rule did not. */}
          {i > 0 && (
            <span className="text-ink/40 text-sm leading-none flex-shrink-0" aria-hidden>
              ·
            </span>
          )}
          <span className="text-sm truncate">{p.name}</span>
          {/* Wrapped rather than passed as a className: `cn` is a plain join
              with no tailwind-merge, so `hidden` on SkillBadge's own
              `inline-flex` would resolve by stylesheet order, not intent. */}
          <span className="hidden sm:inline-flex flex-shrink-0">
            <SkillBadge level={p.skillLevel} compact dense />
          </span>
        </span>
      ))}
    </span>
  );
}

const OUTCOME_STYLES: Record<"win" | "loss" | "draw", string> = {
  win: "bg-primary/15 text-primary",
  loss: "bg-error/15 text-error",
  draw: "bg-surface-elevated text-muted",
};

function MatchRow({
  match,
  outcome,
  isLong,
  isConfirming,
  onVoidStart,
  onVoidCancel,
  onVoidConfirm,
  onRestore,
  selectMode,
  isSelected,
  onToggleSelect,
}: {
  match: MatchRecord;
  /** Framed against the searched player, when there is one. */
  outcome: PlayerOutcome;
  isLong: boolean;
  isConfirming: boolean;
  onVoidStart: () => void;
  onVoidCancel: () => void;
  onVoidConfirm: () => void;
  onRestore: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const winningSide = getWinningSide(match);
  const isDraw = match.status !== "VOIDED" && match.result === "DRAW";
  // The visible row marks the winner with a glyph, which announces as nothing.
  // The label spells the result out so the two convey the same fact.
  const matchupText = winningSide
    ? `${formatSideText(winningSide === "A" ? match.sideA : match.sideB)} beat ${formatSideText(
        winningSide === "A" ? match.sideB : match.sideA
      )}`
    : `${formatSideText(match.sideA)} ${isDraw ? "drew with" : "vs"} ${formatSideText(match.sideB)}`;
  const durationMs = matchDurationMs(match);
  const upset = matchUpset(match);
  const isVoided = match.status === "VOIDED";

  // Void-confirm swaps the "Void" button out for Cancel/Confirm via conditional
  // render, which drops focus to the document unless moved explicitly. Restore
  // the focus a keyboard/screen-reader user would expect at each transition.
  const voidBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const restoreBtnRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(isConfirming);

  useEffect(() => {
    if (isConfirming && !wasConfirming.current) {
      cancelBtnRef.current?.focus();
    } else if (!isConfirming && wasConfirming.current) {
      if (match.status === "VOIDED") restoreBtnRef.current?.focus();
      else voidBtnRef.current?.focus();
    }
    wasConfirming.current = isConfirming;
  }, [isConfirming, match.status]);

  const selectable = selectMode && match.status === "COMPLETED";

  const toneFor = (side: "A" | "B"): "winner" | "loser" | "neutral" => {
    if (!winningSide) return "neutral";
    return winningSide === side ? "winner" : "loser";
  };

  return (
    <div
      role="listitem"
      onClick={selectable ? onToggleSelect : undefined}
      className={cn(
        "flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 px-4 sm:px-6 py-3 border-b border-border",
        "hover:bg-surface-elevated/40 transition-colors",
        isVoided && "opacity-50",
        isConfirming && "ring-1 ring-inset ring-error/30 bg-error/5",
        selectable && "cursor-pointer",
        selectMode && isSelected && "ring-1 ring-inset ring-primary/30 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {selectMode && (
          <div className="flex-shrink-0 w-5 flex items-center justify-center pt-1">
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`Select match: ${matchupText}`}
              />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Meta line. Court is deliberately absent: every court in this app
              is identical and auto-numbered, so it can't inform anything about
              the match. `courtName` stays on the record and in the export. */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="text-xs font-mono text-muted tabular-nums flex-shrink-0">
              {formatTime(match.startedAt)}
            </span>
            <span className="text-muted/40 text-xs leading-none" aria-hidden>
              ·
            </span>
            <span className="text-xs text-muted flex-shrink-0">
              {match.matchType === "DOUBLES" ? "Doubles" : "Singles"}
            </span>
            {durationMs !== null && (
              <>
                <span className="text-muted/40 text-xs leading-none" aria-hidden>
                  ·
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-mono tabular-nums flex-shrink-0",
                    // Weight, not colour — a semantic hue would imply something
                    // is wrong with a long match, and nothing is.
                    isLong ? "text-ink font-semibold" : "text-muted"
                  )}
                  title={isLong ? "Ran long for this session" : undefined}
                >
                  {isLong && <Timer size={11} strokeWidth={2.5} aria-hidden />}
                  {formatDurationMs(durationMs)}
                </span>
              </>
            )}
          </div>

          {/* A fixture line: two sides joined by "vs", with the result marked
              on the winner. The aria-label carries the result in words, since
              a glyph announces as nothing. */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap" aria-label={matchupText}>
            <span aria-hidden="true" className="contents">
              <TeamChip players={match.sideA} tone={toneFor("A")} />
              <span className="text-xs text-muted/70 flex-shrink-0">vs</span>
              <TeamChip players={match.sideB} tone={toneFor("B")} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 min-h-[24px] flex-shrink-0 lg:ml-auto">
        {upset && !isVoided && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/[0.08] border border-primary/20 rounded px-1.5 py-0.5 flex-shrink-0"
            title={`${formatSideText(upset.side === "A" ? match.sideA : match.sideB)} beat a stronger side`}
          >
            <Zap size={10} strokeWidth={2.5} aria-hidden />
            Upset
          </span>
        )}

        {isVoided && (
          <span className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 bg-surface-elevated text-muted">
            Voided
          </span>
        )}

        {/* Shown regardless of search: with the winner marked by a glyph, an
            unmarked row would otherwise be the only thing saying "draw", and
            absence is a poor way to state a fact. */}
        {isDraw && !outcome && (
          <span className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 bg-surface-elevated text-muted">
            Draw
          </span>
        )}

        {/* Only rendered when a player is searched — a win exists relative to
            someone, and the sentence already says who beat whom otherwise. */}
        {outcome && !isVoided && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded flex-shrink-0",
              OUTCOME_STYLES[outcome]
            )}
          >
            {outcome === "win" ? "Win" : outcome === "loss" ? "Loss" : "Draw"}
          </span>
        )}

        {!selectMode && (
          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            {isConfirming ? (
              <>
                <button
                  ref={cancelBtnRef}
                  onClick={onVoidCancel}
                  className="text-xs text-muted hover:text-ink transition-colors px-2 py-1.5 rounded min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                >
                  Cancel
                </button>
                <button
                  onClick={onVoidConfirm}
                  className="text-xs font-semibold text-error hover:bg-error/15 transition-colors px-2 py-1.5 rounded min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                >
                  Confirm
                </button>
              </>
            ) : isVoided ? (
              <button
                ref={restoreBtnRef}
                onClick={onRestore}
                className="text-xs text-primary hover:text-primary-hover transition-colors px-2 py-1.5 rounded min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Restore
              </button>
            ) : (
              <button
                ref={voidBtnRef}
                onClick={onVoidStart}
                className="text-xs text-muted hover:text-error transition-colors px-2 py-1.5 rounded min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                aria-label={`Void match: ${matchupText}`}
              >
                Void
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <p className="text-sm text-muted">
        {hasFilters ? "No matches found" : "No matches yet"}
      </p>
      {hasFilters ? (
        <button
          onClick={onClearFilters}
          className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
        >
          Clear filters
        </button>
      ) : (
        <p className="text-xs text-muted mt-1">
          Matches appear here once they&rsquo;re completed on the Dashboard.
        </p>
      )}
    </div>
  );
}
