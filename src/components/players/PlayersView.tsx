"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, X, ChevronUp, ChevronDown, Check } from "lucide-react";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { GenderIcon } from "@/components/ui/GenderIcon";
import { PaymentToggle } from "@/components/ui/PaymentToggle";
import { PlayerDrawer } from "./PlayerDrawer";
import { cn, SKILL_LABELS, SKILL_LABELS_SHORT } from "@/lib/utils";
import { useGamesPlayedMap } from "@/lib/match-log-store";
import {
  useQueueSnapshot,
  useBenchSnapshot,
  addPlayerToQueue,
  updateQueuePlayer,
  updateBenchPlayer,
  removeQueueEntry,
  removeBenchEntry,
  restoreQueueEntry,
  restoreBenchEntry,
} from "@/lib/session-store";
import type { Player, SkillLevel, Gender, PaymentStatus } from "@/types";

type Source = "queue" | "bench";
type SortKey = "name" | "skillLevel" | "gender" | "state" | "paymentStatus" | "gamesPlayed" | "sessionJoinedAt";
type SortDir = "asc" | "desc";

const SKILL_LEVELS: SkillLevel[] = ["S", "A", "B", "C", "D", "E", "F"];
const GENDERS: Gender[] = ["M", "F"];
const SKILL_ORDER: Record<SkillLevel, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };
const STATE_ORDER: Record<Source, number> = { queue: 0, bench: 1 };
// Ascending surfaces who still owes money first — the organizer's most useful default.
const PAYMENT_ORDER: Record<PaymentStatus, number> = { UNPAID: 0, WAIVED: 1, PAID: 2 };

// A single row on this page — the Players page has no roster of its own; it's
// a live merge of whoever is currently in the session's queue or bench. Presence
// here IS the "status": there's no separate active/inactive concept anymore.
interface SessionPlayerRow {
  entryId: string;
  source: Source;
  player: Player;
  sessionJoinedAt: string;
}

function formatCheckinTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export interface PlayerSaveData {
  name: string;
  skillLevel: SkillLevel;
  gender?: Gender;
  notes: string;
}

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  className,
  title,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  const isActive = currentKey === key;
  return (
    <th
      title={title}
      onClick={() => onSort(key)}
      role="columnheader"
      aria-sort={isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSort(key); }}
      className={cn(
        "text-xs font-medium py-2.5 whitespace-nowrap cursor-pointer select-none group",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
        isActive ? "text-ink" : "text-muted hover:text-ink",
        className
      )}
    >
      <span className={cn("inline-flex items-center gap-0.5", align === "right" && "justify-end w-full")}>
        {label}
        <span
          className={cn(
            "transition-opacity duration-100",
            isActive ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-30"
          )}
        >
          {isActive && currentDir === "desc" ? (
            <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
          ) : (
            <ChevronUp size={10} strokeWidth={2.5} aria-hidden />
          )}
        </span>
      </span>
    </th>
  );
}

function StateCell({ source }: { source: Source }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          source === "queue" ? "bg-primary" : "bg-border"
        )}
        aria-hidden
      />
      <span className={cn("text-xs font-medium", source === "queue" ? "text-ink" : "text-muted")}>
        {source === "queue" ? "Queued" : "Benched"}
      </span>
    </span>
  );
}

function PlayerTableRow({
  row,
  gamesPlayed,
  onClick,
  onPaymentChange,
}: {
  row: SessionPlayerRow;
  gamesPlayed: number;
  onClick: () => void;
  onPaymentChange: (status: PaymentStatus) => void;
}) {
  const { player } = row;
  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      tabIndex={0}
      role="row"
      aria-label={`${player.name}${row.source === "bench" ? ", benched" : ""}`}
      className={cn(
        "border-b border-border/50 cursor-pointer transition-colors duration-100",
        "hover:bg-surface-elevated/40 focus-visible:outline-none focus-visible:bg-surface-elevated/40"
      )}
    >
      {/* Name */}
      <td className="pl-4 sm:pl-6 pr-3 py-3 min-w-[140px]">
        <span className="text-sm font-medium truncate text-ink">
          {player.name}
        </span>
      </td>

      {/* Skill — always */}
      <td className="px-3 py-3 w-[100px]">
        <SkillBadge level={player.skillLevel} />
      </td>

      {/* Payment — sm+ */}
      <td className="hidden sm:table-cell px-3 py-3 w-[190px]">
        <PaymentToggle value={player.paymentStatus} onChange={onPaymentChange} />
      </td>

      {/* Gender — sm+ */}
      <td className="hidden sm:table-cell px-3 py-3 w-[56px]">
        {player.gender ? (
          <GenderIcon gender={player.gender} size={14} />
        ) : (
          <span className="text-xs text-border">—</span>
        )}
      </td>

      {/* State — sm+ */}
      <td className="hidden sm:table-cell px-3 py-3 w-[84px]">
        <StateCell source={row.source} />
      </td>

      {/* Games — md+ */}
      <td className="hidden md:table-cell px-3 py-3 w-[60px] text-right">
        <span className="font-mono text-sm tabular-nums text-muted">
          {gamesPlayed}
        </span>
      </td>

      {/* Check-in time — lg+ */}
      <td className="hidden lg:table-cell px-3 py-3 w-[88px] text-right">
        <span className="font-mono text-sm tabular-nums text-muted">
          {formatCheckinTime(row.sessionJoinedAt)}
        </span>
      </td>

      {/* Notes — lg+ */}
      <td className="hidden lg:table-cell pl-3 pr-4 sm:pr-6 py-3 max-w-[140px]">
        {player.notes ? (
          <span className="block truncate text-xs text-muted" title={player.notes}>
            {player.notes}
          </span>
        ) : (
          <span className="text-xs text-border">—</span>
        )}
      </td>
    </tr>
  );
}

export function PlayersView() {
  const queue = useQueueSnapshot();
  const bench = useBenchSnapshot();
  const gamesPlayedMap = useGamesPlayedMap();

  const rows = useMemo<SessionPlayerRow[]>(() => [
    ...queue.map((e) => ({ entryId: e.id, source: "queue" as const, player: e.player, sessionJoinedAt: e.sessionJoinedAt })),
    ...bench.map((e) => ({ entryId: e.id, source: "bench" as const, player: e.player, sessionJoinedAt: e.sessionJoinedAt })),
  ], [queue, bench]);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<Set<SkillLevel>>(new Set());
  const [genderFilter, setGenderFilter] = useState<Set<Gender>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SessionPlayerRow | null>(null);
  const [headerShadow, setHeaderShadow] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; onUndo?: () => void } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setHeaderShadow(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const id = Date.now();
    setToast({ id, message, onUndo });
    toastTimerRef.current = setTimeout(
      () => setToast((prev) => (prev?.id === id ? null : prev)),
      onUndo ? 5000 : 2500
    );
  }, []);

  const hasFilters = !!search || skillFilter.size > 0 || genderFilter.size > 0;

  const filteredAndSorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (search && !r.player.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (skillFilter.size > 0 && !skillFilter.has(r.player.skillLevel)) return false;
      if (genderFilter.size > 0 && (!r.player.gender || !genderFilter.has(r.player.gender))) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":        cmp = a.player.name.localeCompare(b.player.name); break;
        case "skillLevel":  cmp = SKILL_ORDER[a.player.skillLevel] - SKILL_ORDER[b.player.skillLevel]; break;
        case "gender":      cmp = (a.player.gender ?? "").localeCompare(b.player.gender ?? ""); break;
        case "state":       cmp = STATE_ORDER[a.source] - STATE_ORDER[b.source]; break;
        case "paymentStatus":   cmp = PAYMENT_ORDER[a.player.paymentStatus] - PAYMENT_ORDER[b.player.paymentStatus]; break;
        case "gamesPlayed":     cmp = (gamesPlayedMap.get(a.player.id) ?? 0) - (gamesPlayedMap.get(b.player.id) ?? 0); break;
        case "sessionJoinedAt": cmp = a.sessionJoinedAt.localeCompare(b.sessionJoinedAt); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, skillFilter, genderFilter, sortKey, sortDir, gamesPlayedMap]);

  const paidCount = useMemo(
    () => filteredAndSorted.filter((r) => r.player.paymentStatus === "PAID").length,
    [filteredAndSorted]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSkillFilter(level: SkillLevel) {
    setSkillFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  function toggleGenderFilter(gender: Gender) {
    setGenderFilter((prev) => {
      const next = new Set(prev);
      if (next.has(gender)) {
        next.delete(gender);
      } else {
        next.add(gender);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSkillFilter(new Set());
    setGenderFilter(new Set());
  }

  function handleAdd() {
    setEditingRow(null);
    setDrawerOpen(true);
  }

  function handleEdit(row: SessionPlayerRow) {
    setEditingRow(row);
    setDrawerOpen(true);
  }

  function handleClose() {
    setDrawerOpen(false);
    setTimeout(() => setEditingRow(null), 220);
  }

  function handleSave(data: PlayerSaveData) {
    const patch = {
      name: data.name,
      skillLevel: data.skillLevel,
      gender: data.gender,
      notes: data.notes || undefined,
    };
    if (!editingRow) {
      addPlayerToQueue(patch);
      showToast(`Added ${data.name.split(" ")[0]} to queue`);
      return;
    }
    if (editingRow.source === "queue") {
      updateQueuePlayer(editingRow.entryId, patch);
    } else {
      updateBenchPlayer(editingRow.entryId, patch);
    }
  }

  function handlePaymentChange(row: SessionPlayerRow, status: PaymentStatus) {
    if (row.source === "queue") {
      updateQueuePlayer(row.entryId, { paymentStatus: status });
    } else {
      updateBenchPlayer(row.entryId, { paymentStatus: status });
    }
  }

  function handleRemove() {
    if (!editingRow) return;
    const { entryId, source, player } = editingRow;
    if (source === "queue") {
      const removed = removeQueueEntry(entryId);
      if (removed) {
        showToast(`Removed ${player.name.split(" ")[0]} from the session`, () => restoreQueueEntry(removed));
      }
    } else {
      const removed = removeBenchEntry(entryId);
      if (removed) {
        showToast(`Removed ${player.name.split(" ")[0]} from the session`, () => restoreBenchEntry(removed));
      }
    }
  }

  return (
    <>
      <div className="flex flex-col min-h-full">
        {/* ── Sticky title + filter bar ────────────────────── */}
        <div className={cn("sticky top-0 z-[var(--z-sticky)] bg-bg transition-shadow duration-200", headerShadow && "shadow-[0_1px_0_var(--color-border),0_2px_8px_oklch(0_0_0/0.08)]")}>
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 h-14">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold text-ink">Players</h1>
              <span className="font-mono text-xs text-muted tabular-nums">
                ({filteredAndSorted.length})
              </span>
              {filteredAndSorted.length > 0 && (
                <span className="text-xs text-muted">
                  <span className="font-mono tabular-nums text-success">{paidCount}</span> paid
                </span>
              )}
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-bg text-sm font-semibold px-3 py-1.5 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[44px]"
            >
              <UserPlus size={14} strokeWidth={2.5} aria-hidden />
              Add Player
            </button>
          </div>

          {/* Filter bar — single non-wrapping scrollable row */}
          <div className="relative">
          <div className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Search */}
            <div className="relative flex-shrink-0 w-[160px] sm:w-[188px]">
              <Search
                size={12}
                strokeWidth={2}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface border border-border rounded-md pl-7 pr-7 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors duration-150 h-8"
                aria-label="Search players by name"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus-visible:outline-none rounded"
                  aria-label="Clear search"
                >
                  <X size={11} strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />

            {/* Skill filter chips */}
            <div
              className="flex items-center gap-0.5 flex-shrink-0"
              role="group"
              aria-label="Filter by skill level"
            >
              {SKILL_LEVELS.map((level) => {
                const active = skillFilter.has(level);
                return (
                  <button
                    key={level}
                    onClick={() => toggleSkillFilter(level)}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Add"} ${SKILL_LABELS[level]} filter`}
                    title={SKILL_LABELS[level]}
                    className={cn(
                      "h-7 px-2 flex items-center justify-center rounded-sm text-[10px] font-semibold flex-shrink-0 whitespace-nowrap",
                      "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {SKILL_LABELS_SHORT[level]}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border/60 flex-shrink-0" aria-hidden />

            {/* Gender filter chips */}
            <div
              className="flex items-center gap-0.5 flex-shrink-0"
              role="group"
              aria-label="Filter by gender"
            >
              {GENDERS.map((gender) => {
                const active = genderFilter.has(gender);
                const label = gender === "M" ? "Male" : "Female";
                return (
                  <button
                    key={gender}
                    onClick={() => toggleGenderFilter(gender)}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Add"} ${label} filter`}
                    className={cn(
                      "h-7 px-2 flex items-center justify-center rounded-sm text-[11px] font-medium flex-shrink-0",
                      "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      active
                        ? "bg-surface-elevated text-ink border border-border ring-1 ring-primary/50"
                        : "text-muted hover:bg-surface-elevated hover:text-ink"
                    )}
                  >
                    {gender}
                  </button>
                );
              })}
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary hover:text-primary-hover transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 h-7 ml-auto"
              >
                Clear
              </button>
            )}
          </div>
          {/* Right-edge scroll fade — communicates horizontal scrollability */}
          <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-bg to-transparent pointer-events-none" aria-hidden />
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────── */}
        {filteredAndSorted.length > 0 ? (
          <table className="w-full border-collapse" role="grid" aria-label="Players roster">
              {/* Sticky thead — sits directly below the 109px sticky header */}
              <thead className="sticky top-[109px] z-[var(--z-sticky)] bg-bg">
                <tr className="border-b border-border">
                  <SortHeader
                    label="Name"
                    sortKey="name"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="pl-4 sm:pl-6 pr-3"
                  />
                  <SortHeader
                    label="Skill"
                    sortKey="skillLevel"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="px-3 w-[100px]"
                  />
                  <SortHeader
                    label="Payment"
                    sortKey="paymentStatus"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="hidden sm:table-cell px-3 w-[190px]"
                    title="Paid, unpaid, or waived for this session"
                  />
                  <SortHeader
                    label="Gender"
                    sortKey="gender"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="hidden sm:table-cell px-3 w-[56px]"
                  />
                  <SortHeader
                    label="State"
                    sortKey="state"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="hidden sm:table-cell px-3 w-[84px]"
                    title="Queued or benched right now"
                  />
                  <SortHeader
                    label="Games"
                    sortKey="gamesPlayed"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                    className="hidden md:table-cell px-3 w-[60px]"
                    title="Games played this session"
                  />
                  <SortHeader
                    label="Check-in"
                    sortKey="sessionJoinedAt"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={handleSort}
                    align="right"
                    className="hidden lg:table-cell px-3 w-[88px]"
                    title="Time player checked into this session"
                  />
                  <th className="hidden lg:table-cell text-left text-xs font-medium text-muted pl-3 pr-4 sm:pr-6 py-2.5 whitespace-nowrap">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((row) => (
                  <PlayerTableRow
                    key={row.entryId}
                    row={row}
                    gamesPlayed={gamesPlayedMap.get(row.player.id) ?? 0}
                    onClick={() => handleEdit(row)}
                    onPaymentChange={(status) => handlePaymentChange(row, status)}
                  />
                ))}
              </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            {hasFilters ? (
              <>
                <p className="text-sm text-muted">No players match these filters</p>
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">No players in this session yet</p>
                <button
                  onClick={handleAdd}
                  className="text-xs text-primary hover:text-primary-hover mt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                >
                  Add first player
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <PlayerDrawer
        isOpen={drawerOpen}
        editingPlayer={editingRow?.player ?? null}
        onClose={handleClose}
        onSave={handleSave}
        onRemove={handleRemove}
      />

      {toast && (
        <div
          key={toast.id}
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
                  if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                  const undo = toast.onUndo;
                  setToast(null);
                  undo?.();
                }}
                className="text-primary hover:text-primary-hover font-semibold transition-colors focus-visible:outline-none focus-visible:underline"
                aria-label="Undo remove from session"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
