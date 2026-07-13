"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Activity, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog, updateMatchRecord } from "@/lib/match-log-store";
import { useSessionOptions } from "@/lib/session-store";
import { SessionSelect } from "@/components/ui/SessionSelect";
import { useToast, ToastViewport } from "@/components/ui/Toast";
import type { MatchRecord, Player } from "@/types";

type ResultFilter = "all" | "wins" | "losses" | "draws" | "voided";
// "side_a"/"side_b" (a decisive result with no player search active) used to
// have their own badge variant, but that badge just repeated the winning
// side's names — now redundant with the winning TeamChip's own color. Only
// draw/voided (no color difference to show) and win/loss (framed relative to
// a searched player) still need a text badge.
type BadgeVariant = "win" | "loss" | "draw" | "voided";
type MatchListItem =
  | { type: "match"; data: MatchRecord }
  | { type: "group-header"; label: string };

const RESULT_FILTERS: { key: ResultFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
  { key: "draws", label: "Draws" },
  { key: "voided", label: "Voided" },
];

const BADGE_STYLES: Record<BadgeVariant, string> = {
  win:    "bg-primary/15 text-primary",
  loss:   "bg-error/15 text-error",
  draw:   "bg-surface-elevated text-muted",
  voided: "bg-surface-elevated text-muted",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatHourGroup(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    hour12: true,
  });
}

// Plain-text join — for non-visual contexts (aria-label, title tooltips) where
// "&" reads fine since there's no visual separation to get wrong.
function formatSideText(players: Player[]): string {
  return players.map((p) => p.name).join(" & ");
}

function getMatchedPlayer(match: MatchRecord, query: string): Player | null {
  if (!query.trim()) return null;
  const q = query.toLowerCase();
  return (
    [...match.sideA, ...match.sideB].find((p) =>
      p.name.toLowerCase().includes(q)
    ) ?? null
  );
}

// null = a decisive result with no player search active — the winning
// TeamChip's own color already communicates it, so no badge is needed.
function getBadgeVariant(
  match: MatchRecord,
  matchedPlayer: Player | null
): BadgeVariant | null {
  if (match.status === "VOIDED") return "voided";
  if (!match.result) return "voided";
  if (match.result === "DRAW") return "draw";

  if (matchedPlayer) {
    const inA = match.sideA.some((p) => p.id === matchedPlayer.id);
    const inB = match.sideB.some((p) => p.id === matchedPlayer.id);
    if (inA) return match.result === "SIDE_A" ? "win" : "loss";
    if (inB) return match.result === "SIDE_B" ? "win" : "loss";
  }

  return null;
}

function getBadgeLabel(variant: BadgeVariant): string {
  if (variant === "win") return "Win";
  if (variant === "loss") return "Loss";
  if (variant === "draw") return "Draw";
  return "Voided";
}

// Which side's TeamChip gets colorized as the winner — null for a draw,
// voided match, or one still without a result (nothing to highlight).
function getWinningSide(match: MatchRecord): "A" | "B" | null {
  if (match.status === "VOIDED" || !match.result || match.result === "DRAW") return null;
  return match.result === "SIDE_A" ? "A" : "B";
}

function passesResultFilter(
  match: MatchRecord,
  filter: ResultFilter,
  matchedPlayer: Player | null
): boolean {
  if (filter === "all") return true;
  if (filter === "voided") return match.status === "VOIDED";
  if (filter === "draws")
    return match.result === "DRAW" && match.status !== "VOIDED";

  if (match.status === "VOIDED" || !match.result) return false;

  if (filter === "wins") {
    if (matchedPlayer) {
      const inA = match.sideA.some((p) => p.id === matchedPlayer.id);
      const inB = match.sideB.some((p) => p.id === matchedPlayer.id);
      if (inA) return match.result === "SIDE_A";
      if (inB) return match.result === "SIDE_B";
      return false;
    }
    return match.result === "SIDE_A";
  }

  if (filter === "losses") {
    if (matchedPlayer) {
      const inA = match.sideA.some((p) => p.id === matchedPlayer.id);
      const inB = match.sideB.some((p) => p.id === matchedPlayer.id);
      if (inA) return match.result === "SIDE_B";
      if (inB) return match.result === "SIDE_A";
      return false;
    }
    return match.result === "SIDE_B";
  }

  return true;
}

export function MatchesView() {
  const matches = useMatchLog();
  const { sessions, selectedSessionId, setSelectedSessionId } = useSessionOptions();
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { toast, showToast, dismissAndUndo } = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);

  // Voiding is a real soft-delete, not toast-window-only: a voided row keeps a
  // persistent "Restore" action indefinitely, not just during the undo toast.
  // previousResult preserves the original result so Restore brings back the
  // real outcome instead of leaving it permanently blank.
  const handleRestore = useCallback((id: string) => {
    const match = matches.find((m) => m.id === id);
    updateMatchRecord(id, {
      status: "COMPLETED",
      result: match?.previousResult ?? null,
      previousResult: undefined,
    });
  }, [matches]);

  const handleVoid = useCallback(
    (id: string) => {
      const match = matches.find((m) => m.id === id);
      updateMatchRecord(id, { status: "VOIDED", result: null, previousResult: match?.result ?? null });
      setConfirmingId(null);
      showToast("Match voided", () => handleRestore(id), "Undo void");
    },
    [matches, showToast, handleRestore]
  );

  // A match can only be selected while it's COMPLETED (voiding an already-voided
  // match makes no sense). Prune stale ids if a selected match is restored,
  // voided elsewhere, or removed by a cross-tab sync while mid-review.
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

  const filteredMatches = useMemo(() => {
    return sessionMatches.filter((match) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const hasPlayer = [...match.sideA, ...match.sideB].some((p) =>
          p.name.toLowerCase().includes(q)
        );
        if (!hasPlayer) return false;
      }
      const matchedPlayer = getMatchedPlayer(match, search);
      return passesResultFilter(match, resultFilter, matchedPlayer);
    });
  }, [sessionMatches, search, resultFilter]);

  const visibleSelectableCount = useMemo(
    () => filteredMatches.filter((m) => m.status === "COMPLETED").length,
    [filteredMatches]
  );

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of filteredMatches) {
        if (m.status === "COMPLETED") next.add(m.id);
      }
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

  const hasFilters = !!search.trim() || resultFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setResultFilter("all");
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
          {/* Hidden on mobile — SessionSelect joining this row on the right
              left no room for it at 375px; the filtered list itself already
              communicates count there. */}
          <span className="hidden sm:inline font-mono text-xs text-muted tabular-nums">
            (
            {filteredMatches.length !== sessionMatches.length
              ? `${filteredMatches.length} of ${sessionMatches.length}`
              : sessionMatches.length}
            )
          </span>
          <span className="hidden sm:inline text-xs text-muted">
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
                {/* Text label hidden on mobile — the icon + aria-label carry
                    the meaning, and the space is needed for SessionSelect. */}
                <span className="hidden sm:inline">Select</span>
              </button>
            )}
            <SessionSelect sessions={sessions} value={selectedSessionId} onChange={setSelectedSessionId} />
          </div>
        </div>

        {/* Mobile-only local-storage transparency line — shown inline in the title
            bar at sm+, but that's hidden on phones, which is exactly the device
            class this app targets first courtside. Deliberately the global
            total, not session-scoped — "how much is stored" is a different
            question than "what am I looking at right now" (the count badge
            above already answers that one). */}
        <p className="sm:hidden px-4 pt-2 pb-1.5 text-xs text-muted border-b border-border">
          {matches.length} match{matches.length !== 1 ? "es" : ""} recorded locally
        </p>

        {/* Filter bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search */}
          <div className="relative sm:w-[240px] flex-shrink-0">
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

          {/* Result filter pills — horizontally scrollable, matching
              LeaderboardView's identical treatment: five pills' rendered
              width depends on actual font metrics, not just this estimate,
              so a scroll fallback is cheap insurance against clipping on
              narrow phones rather than a hard breakpoint-tested guarantee. */}
          <div
            className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            role="group"
            aria-label="Filter by result"
          >
            {RESULT_FILTERS.map(({ key, label }) => {
              const active = resultFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setResultFilter(key)}
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

      {/* Match list */}
      <div>
        {groupedItems.length > 0 ? (
          <div role="list" aria-label="Match history">
            {groupedItems.map((item, i) => {
              if (item.type === "group-header") {
                return (
                  <div
                    key={`hdr-${item.label}-${i}`}
                    className="px-4 sm:px-6 py-1.5 border-b border-border/60"
                    aria-hidden
                  >
                    <span className="text-[11px] font-mono text-muted/50 tabular-nums">
                      {item.label}
                    </span>
                  </div>
                );
              }

              const match = item.data;
              const matchedPlayer = getMatchedPlayer(match, search);
              const badgeVariant = getBadgeVariant(match, matchedPlayer);
              const badgeLabel = badgeVariant ? getBadgeLabel(badgeVariant) : null;
              const winningSide = getWinningSide(match);
              const isConfirming = confirmingId === match.id;

              return (
                <MatchRow
                  key={match.id}
                  match={match}
                  badgeVariant={badgeVariant}
                  badgeLabel={badgeLabel}
                  winningSide={winningSide}
                  isConfirming={isConfirming}
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
            // by the same inset — no extra padding needed here, just a taller
            // offset to match. At md+: BottomBar doesn't exist, so this bar
            // sits flush at the true bottom edge and needs its own inset.
            "fixed bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-[var(--z-toast)]",
            "bg-surface border-t border-border px-4 sm:px-6 pt-3 pb-3 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-lg"
          )}
        >
          {!batchConfirming ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink flex-1">
                {selectedIds.size} selected
              </span>
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
                Void {selectedIds.size} match{selectedIds.size !== 1 ? "es" : ""}? This can be restored per-match afterward.
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

function TeamChip({ players, isWinner }: { players: Player[]; isWinner: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 min-w-0 flex-shrink px-2 py-1 rounded-md border transition-colors",
        isWinner
          ? "bg-surface-elevated border-primary/40 text-primary"
          : "bg-surface-elevated/70 border-transparent text-ink"
      )}
    >
      {players.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1.5 min-w-0">
          {/* A middot reads clearly as "separate player" even with full names
              now shown — the previous 1px rule was too faint to notice next
              to a two-word name like "Aims Guinto", where it wasn't obvious
              whether that was one player or two. */}
          {i > 0 && (
            <span className="text-ink text-sm leading-none flex-shrink-0" aria-hidden>
              ·
            </span>
          )}
          <span className="text-sm truncate">{p.name}</span>
        </span>
      ))}
    </span>
  );
}

function MatchRow({
  match,
  badgeVariant,
  badgeLabel,
  winningSide,
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
  badgeVariant: BadgeVariant | null;
  badgeLabel: string | null;
  winningSide: "A" | "B" | null;
  isConfirming: boolean;
  onVoidStart: () => void;
  onVoidCancel: () => void;
  onVoidConfirm: () => void;
  onRestore: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const matchupText = `${formatSideText(match.sideA)} vs ${formatSideText(match.sideB)}`;
  const courtType = `${match.courtName} · ${match.matchType === "DOUBLES" ? "Doubles" : "Singles"}`;
  const time = formatTime(match.startedAt);

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

  return (
    <div
      role="listitem"
      onClick={selectable ? onToggleSelect : undefined}
      className={cn(
        "flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 px-4 sm:px-6 py-3 border-b border-border",
        "hover:bg-surface-elevated/40 transition-colors",
        match.status === "VOIDED" && "opacity-50",
        isConfirming && "ring-1 ring-inset ring-error/30 bg-error/5",
        selectable && "cursor-pointer",
        selectMode && isSelected && "ring-1 ring-inset ring-primary/30 bg-primary/5"
      )}
    >
      {/* Row 1 below lg: (checkbox +) meta/matchup, given the full row width so
          player pills no longer share space with the badge/action area. At
          lg:, `contents` drops this wrapper's own box so its children rejoin
          the outer row as direct flex items — the exact pre-existing desktop
          layout, same DOM/refs, no duplicated markup. */}
      <div className="flex items-center gap-3 lg:contents">
        {/* Selection checkbox — only COMPLETED matches can be batch-voided */}
        {selectMode && (
          <div className="flex-shrink-0 w-5 flex items-center justify-center">
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
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-mono text-muted tabular-nums flex-shrink-0">
              {time}
            </span>
            <span className="text-muted/40 text-xs leading-none" aria-hidden>·</span>
            <span className="text-xs text-muted truncate">{courtType}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0" aria-label={matchupText}>
            <span aria-hidden="true" className="contents">
              <TeamChip players={match.sideA} isWinner={winningSide === "A"} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/60 flex-shrink-0">
                vs
              </span>
              <TeamChip players={match.sideB} isWinner={winningSide === "B"} />
            </span>
          </div>
        </div>
      </div>

      {/* Row 2 below lg: result badge (left) + action button(s) (right). Same
          `contents` trick rejoins the outer row at lg:. `ml-auto` on the
          action area (not `justify-between` on this wrapper) keeps it pinned
          right whether or not the badge renders — a decisive result with no
          player search active now shows no badge at all (the winning
          TeamChip's own color already says who won), and `justify-between`
          with a single child would otherwise snap to the start instead.
          `min-h-[24px]` (ignored once `lg:contents` drops this box) stops the
          row from collapsing in select mode, where the action area is also
          hidden — without it, a badge-less decisive match would render
          visibly shorter than a draw/voided row sitting next to it. */}
      <div className="flex items-center gap-2 min-h-[24px] lg:contents">
        {/* Result badge — only for states color alone can't express (draw,
            voided) or that are framed relative to a searched player (win/loss).
            A decisive result with no search active shows nothing here. */}
        {badgeVariant && badgeLabel && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 max-w-[96px] truncate",
              BADGE_STYLES[badgeVariant]
            )}
            title={badgeLabel}
          >
            {badgeLabel}
          </span>
        )}

        {/* Void / Restore area — hidden in select mode, replaced by the checkbox */}
        {!selectMode && (
          <div className="flex-shrink-0 flex items-center justify-end gap-1 min-w-[72px] ml-auto">
            {match.status === "COMPLETED" && !isConfirming && (
              <button
                ref={voidBtnRef}
                onClick={onVoidStart}
                className="text-xs text-muted hover:text-error transition-colors px-2 py-1 rounded min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                aria-label={`Void match: ${matchupText}`}
              >
                Void
              </button>
            )}
            {match.status === "VOIDED" && (
              <button
                ref={restoreBtnRef}
                onClick={onRestore}
                className="text-xs text-primary hover:text-primary-hover transition-colors px-2 py-1 rounded min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`Restore match: ${matchupText}`}
              >
                Restore
              </button>
            )}
            {isConfirming && (
              <>
                <button
                  ref={cancelBtnRef}
                  onClick={onVoidCancel}
                  aria-label="Cancel void"
                  className="text-xs text-muted hover:text-ink transition-colors px-3 py-1 rounded min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                >
                  Cancel
                </button>
                <button
                  onClick={onVoidConfirm}
                  aria-label="Confirm void"
                  className="text-xs text-error font-medium hover:text-error/70 transition-colors px-3 py-1 rounded min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
                >
                  Void
                </button>
              </>
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
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <p className="text-sm text-muted">No matches match your filters</p>
        <button
          onClick={onClearFilters}
          className="text-xs text-primary hover:text-primary-hover mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
        <Activity size={20} strokeWidth={1.75} className="text-muted" aria-hidden />
      </div>
      <h2
        className="text-sm font-semibold text-ink mb-1"
        style={{ textWrap: "balance" } as React.CSSProperties}
      >
        No matches yet
      </h2>
      <p className="text-xs text-muted">
        Matches you end or void on the Dashboard will appear here
      </p>
    </div>
  );
}
