"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X, Activity, Download, Check, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatchLog, updateMatchRecord } from "@/lib/match-log-store";
import { downloadMatchLogCsv } from "@/lib/export-matches";
import type { MatchRecord, Player } from "@/types";

type ResultFilter = "all" | "wins" | "losses" | "draws" | "voided";
type BadgeVariant = "win" | "loss" | "draw" | "side_a" | "side_b" | "voided";
type ToastPayload = { message: string; onUndo?: () => void };
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
  side_a: "bg-primary/15 text-primary",
  side_b: "bg-accent/15 text-accent",
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
  return players.map((p) => p.name.split(" ")[0]).join(" & ");
}

// Compact visible join for the small result badge — a middot instead of "&",
// lighter than a word-glue but still just text; the badge is a secondary,
// already-small indicator that doesn't warrant its own chip layout.
function formatSideCompact(players: Player[]): string {
  return players.map((p) => p.name.split(" ")[0]).join(" · ");
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

function getBadgeVariant(
  match: MatchRecord,
  matchedPlayer: Player | null
): BadgeVariant {
  if (match.status === "VOIDED") return "voided";
  if (!match.result) return "voided";
  if (match.result === "DRAW") return "draw";

  if (matchedPlayer) {
    const inA = match.sideA.some((p) => p.id === matchedPlayer.id);
    const inB = match.sideB.some((p) => p.id === matchedPlayer.id);
    if (inA) return match.result === "SIDE_A" ? "win" : "loss";
    if (inB) return match.result === "SIDE_B" ? "win" : "loss";
  }

  return match.result === "SIDE_A" ? "side_a" : "side_b";
}

function getBadgeLabel(match: MatchRecord, variant: BadgeVariant): string {
  if (variant === "side_a") return formatSideCompact(match.sideA);
  if (variant === "side_b") return formatSideCompact(match.sideB);
  if (variant === "win") return "Win";
  if (variant === "loss") return "Loss";
  if (variant === "draw") return "Draw";
  return "Voided";
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
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);

  // Matches the Dashboard's own toast timing/urgency convention (DashboardClient.tsx)
  // for this identical void-with-undo action — previously diverged (3000ms/polite
  // here vs. 5000ms/assertive there) despite writing through the same store.
  const showToast = useCallback((message: string, onUndo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, onUndo });
    toastTimer.current = setTimeout(() => setToast(null), onUndo ? 5000 : 2500);
  }, []);

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
      showToast("Match voided", () => handleRestore(id));
    },
    [matches, showToast, handleRestore]
  );

  const handleExport = useCallback(() => {
    downloadMatchLogCsv(matches);
  }, [matches]);

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
    showToast(`Voided ${ids.length} match${ids.length !== 1 ? "es" : ""}`, () => {
      for (const id of ids) handleRestore(id);
    });
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

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
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
  }, [matches, search, resultFilter]);

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

  return (
    <div className={cn("flex flex-col min-h-full", selectMode && "pb-20")}>
      {/* Sticky header + filter bar */}
      <div className="sticky top-0 z-[var(--z-sticky)] bg-bg">
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 sm:px-6 h-14 border-b border-border">
          <h1 className="text-lg font-semibold text-ink">Matches</h1>
          <span className="font-mono text-xs text-muted tabular-nums">
            (
            {filteredMatches.length !== matches.length
              ? `${filteredMatches.length} of ${matches.length}`
              : matches.length}
            )
          </span>
          <span className="hidden sm:inline text-xs text-muted">
            · {matches.length} recorded locally
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!selectMode && (
              <button
                onClick={() => setSelectMode(true)}
                disabled={matches.length === 0}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2.5 py-1.5 rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent min-h-[36px]"
                aria-label="Select multiple matches to void at once"
              >
                <ListChecks size={13} strokeWidth={2} aria-hidden />
                Select
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={matches.length === 0}
              title={matches.length === 0 ? "No matches to export yet" : undefined}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-elevated transition-colors px-2.5 py-1.5 rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted disabled:hover:bg-transparent min-h-[36px]"
              aria-label="Export match log as a spreadsheet"
            >
              <Download size={13} strokeWidth={2} aria-hidden />
              Export
            </button>
          </div>
        </div>

        {/* Mobile-only local-storage transparency line — shown inline in the title
            bar at sm+, but that's hidden on phones, which is exactly the device
            class this app targets first courtside. */}
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
              className="w-full bg-surface border border-border rounded-md pl-7 pr-7 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-8"
              aria-label="Search by player name"
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

          {/* Result filter pills */}
          <div
            className="flex items-center gap-1"
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
                    "h-7 px-2.5 flex items-center rounded-md text-xs font-medium flex-shrink-0",
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
              const badgeLabel = getBadgeLabel(match, badgeVariant);
              const isConfirming = confirmingId === match.id;

              return (
                <MatchRow
                  key={match.id}
                  match={match}
                  badgeVariant={badgeVariant}
                  badgeLabel={badgeLabel}
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
          className="fixed bottom-[60px] md:bottom-0 left-0 right-0 z-[var(--z-toast)] bg-surface border-t border-border px-4 sm:px-6 py-3 shadow-lg"
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

      {/* Toast — matches DashboardClient's chrome/urgency for the identical action */}
      {toast && (
        <div
          role={toast.onUndo ? "alert" : "status"}
          aria-live={toast.onUndo ? "assertive" : "polite"}
          className={cn(
            "fixed bottom-[76px] md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-elevated border border-border text-ink text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-[var(--z-toast)] animate-toast whitespace-nowrap",
            toast.onUndo ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          <Check size={12} strokeWidth={2.5} className="text-success flex-shrink-0" aria-hidden />
          {toast.message}
          {toast.onUndo && (
            <>
              <span className="w-px h-3 bg-border mx-0.5 flex-shrink-0" aria-hidden />
              <button
                onClick={() => {
                  if (toastTimer.current) clearTimeout(toastTimer.current);
                  const undo = toast.onUndo;
                  setToast(null);
                  undo?.();
                }}
                className="text-primary hover:text-primary-hover font-semibold transition-colors focus-visible:outline-none focus-visible:underline"
                aria-label="Undo void"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TeamChip({ players }: { players: Player[] }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 flex-shrink px-2 py-1 rounded-md bg-surface-elevated/70">
      {players.map((p, i) => (
        <span key={p.id} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <span className="w-px h-3 bg-border/70 flex-shrink-0" aria-hidden />}
          <span className="text-sm text-ink truncate">{p.name.split(" ")[0]}</span>
        </span>
      ))}
    </span>
  );
}

function MatchRow({
  match,
  badgeVariant,
  badgeLabel,
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
  badgeVariant: BadgeVariant;
  badgeLabel: string;
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
        "flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border",
        "hover:bg-surface-elevated/40 transition-colors",
        match.status === "VOIDED" && "opacity-50",
        isConfirming && "ring-1 ring-inset ring-error/30 bg-error/5",
        selectable && "cursor-pointer",
        selectMode && isSelected && "ring-1 ring-inset ring-primary/30 bg-primary/5"
      )}
    >
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

      {/* Meta + matchup */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-mono text-muted tabular-nums flex-shrink-0">
            {time}
          </span>
          <span className="text-muted/40 text-xs leading-none" aria-hidden>·</span>
          <span className="text-xs text-muted truncate">{courtType}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0" aria-label={matchupText}>
          <span aria-hidden="true" className="contents">
            <TeamChip players={match.sideA} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/60 flex-shrink-0">
              vs
            </span>
            <TeamChip players={match.sideB} />
          </span>
        </div>
      </div>

      {/* Result badge */}
      <span
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 max-w-[96px] truncate",
          BADGE_STYLES[badgeVariant]
        )}
        title={badgeLabel}
      >
        {badgeLabel}
      </span>

      {/* Void / Restore area — hidden in select mode, replaced by the checkbox */}
      {!selectMode && (
        <div className="flex-shrink-0 flex items-center justify-end gap-1 min-w-[72px]">
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
